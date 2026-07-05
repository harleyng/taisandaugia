-- Asset Postings + Service Requests
-- Hành trình: chủ tài sản cá nhân tự nguyện số hóa hồ sơ tài sản, được gợi ý tổ chức
-- đấu giá phù hợp (matching client-side), chọn một tổ chức và gửi yêu cầu dịch vụ.
-- Tài sản tự nguyện của cá nhân không thuộc diện Điều 56 → tự chọn & ký HĐ dịch vụ.
--
-- Mô hình trường 3 tầng: cột chung (typed) + parent_slug/child_slug + delta_fields JSONB.
-- Các field "bắt buộc" để nullable ở DB (cho phép lưu draft từng phần); Zod enforce ở submit.

-- ─── set_updated_at (idempotent reuse) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── 1. asset_postings ───────────────────────────────────────────────────────
CREATE TABLE public.asset_postings (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Taxonomy 3 tầng (slug từ src/constants/category.constants.ts)
  parent_slug          TEXT NOT NULL,
  child_slug           TEXT NOT NULL,

  -- Chung (mọi loại)
  title                TEXT NOT NULL,
  description          TEXT,
  province             TEXT,
  district             TEXT,
  ward                 TEXT,
  address              TEXT,

  -- Nhu cầu đấu giá
  pricing_mode         TEXT NOT NULL DEFAULT 'self'
                       CHECK (pricing_mode IN ('self', 'appraisal')),
  starting_price       NUMERIC,
  auction_format       TEXT NOT NULL DEFAULT 'truc_tiep'
                       CHECK (auction_format IN ('truc_tiep', 'truc_tuyen', 'ca_hai')),
  commission_pct       NUMERIC,
  expected_timeline    TEXT CHECK (expected_timeline IN ('urgent', 'normal', 'flexible')),

  -- Pháp lý & hiện trạng
  ownership_proof_urls TEXT[] NOT NULL DEFAULT '{}',
  has_dispute          BOOLEAN,
  has_mortgage         BOOLEAN,
  is_seized            BOOLEAN,
  right_to_sell        BOOLEAN NOT NULL DEFAULT true,
  legal_notes          TEXT,

  -- Trường riêng theo loại con (keyed theo descriptor.key)
  delta_fields         JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Media (tùy chọn)
  image_urls           TEXT[] NOT NULL DEFAULT '{}',
  doc_urls             TEXT[] NOT NULL DEFAULT '{}',

  -- Tổ chức đã chọn + workflow
  chosen_org_id        UUID REFERENCES public.auction_organizations(id),
  status               TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'pending', 'matched', 'contracted', 'cancelled')),

  submitted_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.asset_postings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asset_postings_own_rows"
  ON public.asset_postings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_asset_postings_user_id ON public.asset_postings (user_id);
CREATE INDEX idx_asset_postings_status  ON public.asset_postings (status);
CREATE INDEX idx_asset_postings_chosen  ON public.asset_postings (chosen_org_id);

CREATE TRIGGER asset_postings_updated_at
  BEFORE UPDATE ON public.asset_postings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 2. asset_service_requests ───────────────────────────────────────────────
-- Bản ghi này CHÍNH LÀ "thông báo" gửi tổ chức (app chưa có bảng notifications).
CREATE TABLE public.asset_service_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_posting_id  UUID NOT NULL REFERENCES public.asset_postings(id) ON DELETE CASCADE,
  auction_org_id    UUID NOT NULL REFERENCES public.auction_organizations(id),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sent', 'seen', 'accepted', 'declined', 'withdrawn')),
  message           TEXT,
  match_score       NUMERIC(5,2),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (asset_posting_id, auction_org_id)
);

ALTER TABLE public.asset_service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "asr_owner_rows"
  ON public.asset_service_requests FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "asr_admin_read"
  ON public.asset_service_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE INDEX idx_asr_org     ON public.asset_service_requests (auction_org_id);
CREATE INDEX idx_asr_posting ON public.asset_service_requests (asset_posting_id);

CREATE TRIGGER asr_updated_at
  BEFORE UPDATE ON public.asset_service_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. Storage: asset-media (public) + asset-docs (private) ─────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('asset-media', 'asset-media', true,  10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('asset-docs',  'asset-docs',  false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

-- asset-media: ai cũng đọc được (public), chỉ chủ folder (auth.uid()) mới ghi/sửa/xóa
CREATE POLICY "asset_media_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'asset-media');

CREATE POLICY "asset_media_owner_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'asset-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "asset_media_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'asset-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "asset_media_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'asset-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- asset-docs: chỉ chủ folder đọc/ghi/sửa/xóa
CREATE POLICY "asset_docs_owner_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'asset-docs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "asset_docs_owner_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'asset-docs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "asset_docs_owner_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'asset-docs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "asset_docs_owner_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'asset-docs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
