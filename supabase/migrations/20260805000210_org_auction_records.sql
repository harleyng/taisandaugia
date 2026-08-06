-- ─────────────────────────────────────────────────────────────────────────────
-- Lịch sử đấu giá lên Supabase — bảng riêng, không phải tin rao
--
-- VÌ SAO KHÔNG DÙNG `listings`: phần lớn cuộc đấu giá trong hồ sơ năng lực là
-- việc CŨ, có trước cả sàn, nên sẽ không bao giờ tồn tại dưới dạng tin rao.
-- Nhét chúng vào `listings` đồng nghĩa đẩy tài sản không có thật lên sàn công
-- khai và vào báo cáo tin đăng.
--
-- Liên kết người điều hành bằng FK `auctioneer_id` thay cho khớp chuỗi họ tên
-- như trước — đổi tên người là mất sạch liên kết.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_auction_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Denormalize để RPC công khai không phải join qua JSONB license_info.
  auction_org_id  UUID REFERENCES public.auction_organizations(id) ON DELETE SET NULL,
  -- Người điều hành. SET NULL để xoá ĐGV không kéo mất lịch sử của tổ chức.
  auctioneer_id   UUID REFERENCES public.org_auctioneers(id) ON DELETE SET NULL,
  -- Có tin rao tương ứng trên sàn thì trỏ tới; việc cũ thì để NULL.
  listing_id      UUID REFERENCES public.listings(id) ON DELETE SET NULL,

  source TEXT NOT NULL DEFAULT 'MANUAL'
         CHECK (source IN ('MANUAL', 'LISTING', 'IMPORT', 'CRAWLED')),

  auction_date      DATE NOT NULL,
  auction_number    TEXT,
  asset_description TEXT NOT NULL,
  asset_category    TEXT NOT NULL DEFAULT 'OTHER',
  asset_location    TEXT,
  owner_name        TEXT,
  contract_number   TEXT,
  contract_signed_date DATE,

  starting_price NUMERIC(18, 0),
  winning_price  NUMERIC(18, 0),
  is_successful  BOOLEAN,
  failure_reason TEXT,
  number_of_participants INT,
  number_of_bids         INT,

  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Một tin rao chỉ sinh ra một bản ghi lịch sử.
  CONSTRAINT org_auction_records_listing_uq UNIQUE (organization_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_oar_org
  ON public.org_auction_records (organization_id, auction_date DESC);
CREATE INDEX IF NOT EXISTS idx_oar_auctioneer
  ON public.org_auction_records (auctioneer_id, auction_date DESC);

DROP TRIGGER IF EXISTS oar_updated_at ON public.org_auction_records;
CREATE TRIGGER oar_updated_at BEFORE UPDATE ON public.org_auction_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Không có policy public-read: trang công khai đi qua RPC che cột bên dưới.
ALTER TABLE public.org_auction_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oar_select" ON public.org_auction_records;
CREATE POLICY "oar_select" ON public.org_auction_records
  FOR SELECT TO authenticated
  USING (public.can_manage_org_auctioneers(organization_id, 'view'));

DROP POLICY IF EXISTS "oar_insert" ON public.org_auction_records;
CREATE POLICY "oar_insert" ON public.org_auction_records
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_org_auctioneers(organization_id, 'create'));

DROP POLICY IF EXISTS "oar_update" ON public.org_auction_records;
CREATE POLICY "oar_update" ON public.org_auction_records
  FOR UPDATE TO authenticated
  USING (public.can_manage_org_auctioneers(organization_id, 'update'))
  WITH CHECK (public.can_manage_org_auctioneers(organization_id, 'update'));

DROP POLICY IF EXISTS "oar_delete" ON public.org_auction_records;
CREATE POLICY "oar_delete" ON public.org_auction_records
  FOR DELETE TO authenticated
  USING (public.can_manage_org_auctioneers(organization_id, 'delete'));

DROP POLICY IF EXISTS "oar_admin_all" ON public.org_auction_records;
CREATE POLICY "oar_admin_all" ON public.org_auction_records
  FOR ALL USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- ─── Cờ cho phép khoe chỉ số ra bản công khai (spec mục 4 & 5.6) ────────────
ALTER TABLE public.org_auctioneers
  ADD COLUMN IF NOT EXISTS show_public_stats BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.org_auctioneers.show_public_stats IS
  'Cho phép hiện số cuộc / giá trị trúng / danh mục sở trường ở mục Đội ngũ công khai.';

-- ─── RPC công khai: thêm chỉ số nổi bật ─────────────────────────────────────
-- Đổi danh sách cột trả về nên phải DROP trước, CREATE OR REPLACE không đủ.
DROP FUNCTION IF EXISTS public.public_org_auctioneers(UUID);

CREATE FUNCTION public.public_org_auctioneers(_auction_org_id UUID)
RETURNS TABLE (
  id                  UUID,
  full_name           TEXT,
  title               TEXT,
  license_number      TEXT,
  license_issued_date DATE,
  years_of_experience INT,
  portrait_url        TEXT,
  -- Chỉ có giá trị khi đấu giá viên bật show_public_stats; ngược lại NULL.
  total_auctions      INT,
  successful_auctions INT,
  total_winning_value NUMERIC,
  top_category        TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    a.id,
    a.full_name,
    COALESCE(
      NULLIF(a.public_title, ''),
      CASE a.position
        WHEN 'DIRECTOR'        THEN 'Giám đốc'
        WHEN 'DEPUTY_DIRECTOR' THEN 'Phó Giám đốc'
        ELSE 'Đấu giá viên'
      END
    ) AS title,
    a.license_number,
    a.license_issued_date,
    GREATEST(0, EXTRACT(YEAR FROM age(
      now(),
      LEAST(COALESCE(a.practice_start_date, a.license_issued_date), a.license_issued_date)
    ))::int) AS years_of_experience,
    a.portrait_url,
    CASE WHEN a.show_public_stats THEN s.total::int END,
    CASE WHEN a.show_public_stats THEN s.successful::int END,
    CASE WHEN a.show_public_stats THEN s.total_value END,
    CASE WHEN a.show_public_stats THEN s.top_category END
  FROM public.org_auctioneers a
  LEFT JOIN LATERAL (
    SELECT
      count(*)                                          AS total,
      count(*) FILTER (WHERE r.is_successful)           AS successful,
      COALESCE(sum(r.winning_price), 0)                 AS total_value,
      (SELECT r2.asset_category
         FROM public.org_auction_records r2
        WHERE r2.auctioneer_id = a.id
        GROUP BY r2.asset_category
        ORDER BY count(*) DESC, r2.asset_category
        LIMIT 1)                                        AS top_category
    FROM public.org_auction_records r
    WHERE r.auctioneer_id = a.id
  ) s ON true
  WHERE a.auction_org_id = _auction_org_id
    AND a.is_public_profile
    AND a.is_active
  ORDER BY
    CASE a.position WHEN 'DIRECTOR' THEN 0 WHEN 'DEPUTY_DIRECTOR' THEN 1 ELSE 2 END,
    a.license_issued_date;
$$;

GRANT EXECUTE ON FUNCTION public.public_org_auctioneers(UUID) TO anon, authenticated;
