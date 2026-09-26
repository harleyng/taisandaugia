-- Model 3D cho hồ sơ số hoá tài sản ("Thêm 3D" → tự quét bằng điện thoại qua app đối tác).
--
-- Luồng: chủ tài sản bấm "Thêm 3D" → start_asset_3d_scan trừ credit + tạo phiên quét
-- (awaiting_scan) → mở app đối tác bằng deeplink mang scan_ref + lot_id → đối tác
-- xử lý xong gọi webhook (edge function scan3d-webhook, ký HMAC) → attach_asset_3d_model
-- gắn model vào hồ sơ nháp → hồ sơ được admin duyệt thì model mới công khai.
--
-- "lô nháp" trong đặc tả = một dòng asset_postings; lot_id của webhook = asset_postings.id.
--
-- VÌ SAO BẢNG RIÊNG, KHÔNG PHẢI CỘT TRÊN asset_postings:
--   trigger asset_postings_review_guard (1) trả hồ sơ ĐÃ DUYỆT về pending khi có bất kỳ
--   thay đổi nào, và (2) nuốt thay đổi của mọi caller không có quyền approve — kể cả
--   SECURITY DEFINER / service_role. Webhook ghi vào asset_postings sẽ vỡ cả hai.
--
-- VÌ SAO TRỪ CREDIT Ở SERVER: deductCredits phía client là read-then-write không
-- atomic, còn hoàn credit (quét lỗi / hết hạn) buộc phải chạy ở server (webhook).
--
-- BR-3D-01 (chỉ công khai sau khi admin duyệt cùng lô): published_at do trigger trên
--   asset_postings.review_status điều khiển; model về SAU khi đã duyệt vẫn ẩn tới khi
--   admin bấm duyệt riêng (admin_publish_asset_3d_model).
-- BR-3D-02 (gắn đúng lot_id): attach/fail khoá dòng scan và từ chối nếu lot_id lệch.
-- BR-3D-03 (nhãn 3D trong catalogue): đọc qua public_session_lot_3d_models.

-- ─── Bảng ────────────────────────────────────────────────────────────────────

CREATE TABLE public.asset_3d_scans (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_posting_id      UUID        NOT NULL REFERENCES public.asset_postings(id) ON DELETE CASCADE,
  user_id               UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  partner               TEXT        NOT NULL DEFAULT 'mock',
  -- Bí mật đi kèm deeplink; đối tác giả lập phải trình lại. Không lộ ra công khai
  -- (bảng không có policy anon, trang công khai đọc qua RPC chỉ trả cột model).
  scan_token            TEXT        NOT NULL,
  external_job_id       TEXT        UNIQUE,
  status                TEXT        NOT NULL DEFAULT 'awaiting_scan'
                          CHECK (status IN ('awaiting_scan', 'processing', 'ready', 'failed', 'expired', 'superseded')),
  credit_cost           INTEGER     NOT NULL DEFAULT 0 CHECK (credit_cost >= 0),
  credit_transaction_id UUID        REFERENCES public.credit_transactions(id) ON DELETE SET NULL,
  refunded_at           TIMESTAMPTZ,
  model_url             TEXT,
  poster_url            TEXT,
  format                TEXT        CHECK (format IN ('glb', 'usdz', 'embed')),
  error_message         TEXT,
  ready_at              TIMESTAMPTZ,
  published_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT asset_3d_scans_ready_has_model
    CHECK (status <> 'ready' OR (model_url IS NOT NULL AND format IS NOT NULL)),
  CONSTRAINT asset_3d_scans_published_is_ready
    CHECK (published_at IS NULL OR status = 'ready')
);

CREATE INDEX idx_asset_3d_scans_posting ON public.asset_3d_scans (asset_posting_id, created_at DESC);
CREATE INDEX idx_asset_3d_scans_user    ON public.asset_3d_scans (user_id);

-- Một hồ sơ: tối đa MỘT phiên quét đang chạy và MỘT model hiện hành.
CREATE UNIQUE INDEX uq_asset_3d_scans_inflight
  ON public.asset_3d_scans (asset_posting_id) WHERE status IN ('awaiting_scan', 'processing');
CREATE UNIQUE INDEX uq_asset_3d_scans_ready
  ON public.asset_3d_scans (asset_posting_id) WHERE status = 'ready';

CREATE TRIGGER asset_3d_scans_updated_at
  BEFORE UPDATE ON public.asset_3d_scans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS: chỉ ĐỌC. Mọi ghi đi qua RPC / edge function. ───────────────────────

ALTER TABLE public.asset_3d_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY asset_3d_scans_owner_read
  ON public.asset_3d_scans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY asset_3d_scans_admin_read
  ON public.asset_3d_scans FOR SELECT
  USING (public.admin_has_permission('tai-san-tu-nguyen', 'view'));

-- ─── Catalog: giá quét 3D (admin sửa ở /admin/dich-vu) ───────────────────────

INSERT INTO public.services (name, kind, category, audience, credit_feature_key, price, credit_cost, sort_order)
SELECT 'Quét 3D tài sản', 'credit', 'feature', 'owner', 'scan_3d', 0, NULL, 35
WHERE NOT EXISTS (SELECT 1 FROM public.services WHERE name = 'Quét 3D tài sản');

INSERT INTO public.service_variants
  (service_id, variant_key, name, price, base_credits, credits, credit_cost, sort_order)
SELECT s.id, 'scan_3d_owner', 'Tự quét 3D bằng điện thoại', 0, NULL, NULL, 30, 1
FROM public.services s
WHERE s.name = 'Quét 3D tài sản'
ON CONFLICT (variant_key) DO NOTHING;

-- ─── Nội bộ: hoàn credit + hết hạn (KHÔNG cấp quyền gọi) ─────────────────────

CREATE OR REPLACE FUNCTION public._asset_3d_refund(_scan_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_scan public.asset_3d_scans%ROWTYPE;
BEGIN
  -- refunded_at IS NULL trong WHERE là chốt chống hoàn hai lần khi webhook gửi lại.
  UPDATE public.asset_3d_scans
     SET refunded_at = now()
   WHERE id = _scan_id AND refunded_at IS NULL AND credit_cost > 0
  RETURNING * INTO v_scan;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.user_credits (user_id, balance)
  VALUES (v_scan.user_id, v_scan.credit_cost)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.user_credits.balance + EXCLUDED.balance, updated_at = now();

  INSERT INTO public.credit_transactions (user_id, type, description, credit_delta, variant_key)
  VALUES (v_scan.user_id, 'scan_3d_refund', 'Hoàn credit quét 3D (quét không thành công)',
          v_scan.credit_cost, 'scan_3d_owner');
END;
$$;

CREATE OR REPLACE FUNCTION public._asset_3d_expire_stale(_posting_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  FOR v_id IN
    UPDATE public.asset_3d_scans
       SET status = 'expired', error_message = 'Quá hạn chưa nhận được kết quả quét'
     WHERE asset_posting_id = _posting_id
       AND status IN ('awaiting_scan', 'processing')
       AND expires_at < now()
    RETURNING id
  LOOP
    PERFORM public._asset_3d_refund(v_id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._asset_3d_refund(UUID)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._asset_3d_expire_stale(UUID) FROM PUBLIC, anon, authenticated;

-- ─── Chủ tài sản: bắt đầu phiên quét (trừ credit atomic) ─────────────────────

CREATE OR REPLACE FUNCTION public.start_asset_3d_scan(_posting_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_posting    public.asset_postings%ROWTYPE;
  v_scan       public.asset_3d_scans%ROWTYPE;
  v_variant_id UUID;
  v_cost       INTEGER;
  v_tx_id      UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- FOR UPDATE tuần tự hoá hai lần bấm đồng thời trên cùng hồ sơ ⇒ không trừ credit
  -- hai lần. Khoá dòng không kích hoạt trigger UPDATE nên review guard không liên quan.
  SELECT * INTO v_posting
    FROM public.asset_postings
   WHERE id = _posting_id AND user_id = v_uid
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_posting.status IN ('cancelled', 'contracted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_closed');
  END IF;

  PERFORM public._asset_3d_expire_stale(_posting_id);

  -- Đang có phiên quét chạy ⇒ trả lại phiên đó, không trừ thêm.
  SELECT * INTO v_scan
    FROM public.asset_3d_scans
   WHERE asset_posting_id = _posting_id AND status IN ('awaiting_scan', 'processing');
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'reused', true, 'scan_id', v_scan.id,
                              'scan_token', v_scan.scan_token, 'lot_id', _posting_id, 'cost', 0);
  END IF;

  SELECT v.id, v.credit_cost INTO v_variant_id, v_cost
    FROM public.service_variants v
   WHERE v.variant_key = 'scan_3d_owner' AND v.is_active;
  IF v_variant_id IS NULL OR v_cost IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'service_unavailable');
  END IF;

  IF v_cost > 0 THEN
    UPDATE public.user_credits
       SET balance = balance - v_cost, updated_at = now()
     WHERE user_id = v_uid AND balance >= v_cost;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'cost', v_cost);
    END IF;

    INSERT INTO public.credit_transactions
      (user_id, type, description, credit_delta, variant_key, service_variant_id)
    VALUES (v_uid, 'scan_3d', 'Quét 3D tài sản — ' || left(v_posting.title, 80),
            -v_cost, 'scan_3d_owner', v_variant_id)
    RETURNING id INTO v_tx_id;
  END IF;

  INSERT INTO public.asset_3d_scans
    (asset_posting_id, user_id, partner, scan_token, credit_cost, credit_transaction_id)
  VALUES (_posting_id, v_uid, 'mock',
          replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
          v_cost, v_tx_id)
  RETURNING * INTO v_scan;

  RETURN jsonb_build_object('ok', true, 'reused', false, 'scan_id', v_scan.id,
                            'scan_token', v_scan.scan_token, 'lot_id', _posting_id, 'cost', v_cost);
END;
$$;

REVOKE ALL ON FUNCTION public.start_asset_3d_scan(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_asset_3d_scan(UUID) TO authenticated;

-- ─── Webhook (CHỈ service_role): processing / ready / failed ─────────────────
-- PostgREST phơi mọi hàm mà role gọi được ⇒ REVOKE khỏi anon + authenticated, nếu
-- không chủ tài sản tự "gắn" model bất kỳ vào hồ sơ của mình bỏ qua đối tác.

CREATE OR REPLACE FUNCTION public.mark_asset_3d_processing(_scan_id UUID, _lot_id UUID, _job_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_scan public.asset_3d_scans%ROWTYPE;
BEGIN
  SELECT * INTO v_scan FROM public.asset_3d_scans WHERE id = _scan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'scan_not_found');
  END IF;
  IF v_scan.asset_posting_id <> _lot_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_mismatch');
  END IF;
  IF v_scan.external_job_id IS NOT NULL AND v_scan.external_job_id <> _job_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'job_mismatch');
  END IF;
  IF v_scan.status = 'processing' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_scan.status <> 'awaiting_scan' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_scan.status);
  END IF;

  UPDATE public.asset_3d_scans
     SET status = 'processing', external_job_id = _job_id
   WHERE id = _scan_id;
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'reason', 'job_conflict');
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_asset_3d_model(
  _scan_id    UUID,
  _lot_id     UUID,
  _job_id     TEXT,
  _model_url  TEXT,
  _poster_url TEXT,
  _format     TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_scan public.asset_3d_scans%ROWTYPE;
BEGIN
  SELECT * INTO v_scan FROM public.asset_3d_scans WHERE id = _scan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'scan_not_found');
  END IF;
  -- BR-3D-02: model chỉ gắn vào đúng hồ sơ đã mở phiên quét.
  IF v_scan.asset_posting_id <> _lot_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_mismatch');
  END IF;
  IF v_scan.external_job_id IS NOT NULL AND v_scan.external_job_id <> _job_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'job_mismatch');
  END IF;
  -- Webhook gửi lại cùng job ⇒ không làm gì.
  IF v_scan.status IN ('ready', 'superseded') AND v_scan.external_job_id = _job_id THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  -- Đã hết hạn/đã hoàn credit ⇒ không nhận model nữa (tránh "quét miễn phí").
  IF v_scan.status NOT IN ('awaiting_scan', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_scan.status);
  END IF;
  IF _format IS NULL OR _format NOT IN ('glb', 'usdz', 'embed') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_format');
  END IF;
  IF _model_url IS NULL OR _model_url !~ '^https://' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_url');
  END IF;

  -- Model cũ nhường chỗ. Model mới luôn bắt đầu CHƯA công khai (BR-3D-01).
  UPDATE public.asset_3d_scans
     SET status = 'superseded', published_at = NULL
   WHERE asset_posting_id = v_scan.asset_posting_id AND status = 'ready';

  UPDATE public.asset_3d_scans
     SET status          = 'ready',
         external_job_id = _job_id,
         model_url       = _model_url,
         poster_url      = NULLIF(_poster_url, ''),
         format          = _format,
         ready_at        = now(),
         published_at    = NULL,
         error_message   = NULL
   WHERE id = _scan_id;

  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'reason', 'job_conflict');
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_asset_3d_scan(_scan_id UUID, _lot_id UUID, _job_id TEXT, _reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_scan public.asset_3d_scans%ROWTYPE;
BEGIN
  SELECT * INTO v_scan FROM public.asset_3d_scans WHERE id = _scan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'scan_not_found');
  END IF;
  IF v_scan.asset_posting_id <> _lot_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'lot_mismatch');
  END IF;
  IF v_scan.external_job_id IS NOT NULL AND _job_id IS NOT NULL AND v_scan.external_job_id <> _job_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'job_mismatch');
  END IF;
  IF v_scan.status IN ('failed', 'expired') THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_scan.status NOT IN ('awaiting_scan', 'processing') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_scan.status);
  END IF;

  UPDATE public.asset_3d_scans
     SET status          = 'failed',
         external_job_id = COALESCE(external_job_id, _job_id),
         error_message   = left(COALESCE(NULLIF(_reason, ''), 'Đối tác báo quét không thành công'), 500)
   WHERE id = _scan_id;

  PERFORM public._asset_3d_refund(_scan_id);
  RETURN jsonb_build_object('ok', true, 'refunded', v_scan.credit_cost);
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'reason', 'job_conflict');
END;
$$;

REVOKE ALL ON FUNCTION public.mark_asset_3d_processing(UUID, UUID, TEXT)                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.attach_asset_3d_model(UUID, UUID, TEXT, TEXT, TEXT, TEXT)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_asset_3d_scan(UUID, UUID, TEXT, TEXT)                 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_asset_3d_processing(UUID, UUID, TEXT)                 TO service_role;
GRANT EXECUTE ON FUNCTION public.attach_asset_3d_model(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_asset_3d_scan(UUID, UUID, TEXT, TEXT)                TO service_role;

-- ─── Công khai theo duyệt hồ sơ (BR-3D-01) ───────────────────────────────────
-- KHÔNG dùng "AFTER UPDATE OF review_status": cột đó kiểm danh sách SET của câu
-- UPDATE, còn guard tự đổi review_status approved→pending trong BEFORE trigger khi
-- chủ tài sản sửa hồ sơ — UPDATE OF sẽ không bắn và model vẫn công khai.

CREATE OR REPLACE FUNCTION public.asset_3d_sync_publish()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.review_status = 'approved' THEN
    UPDATE public.asset_3d_scans
       SET published_at = now()
     WHERE asset_posting_id = NEW.id AND status = 'ready' AND published_at IS NULL;
  ELSE
    UPDATE public.asset_3d_scans
       SET published_at = NULL
     WHERE asset_posting_id = NEW.id AND published_at IS NOT NULL;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER asset_postings_3d_sync_publish
  AFTER UPDATE ON public.asset_postings
  FOR EACH ROW
  WHEN (OLD.review_status IS DISTINCT FROM NEW.review_status)
  EXECUTE FUNCTION public.asset_3d_sync_publish();

-- Model về SAU khi hồ sơ đã duyệt: admin duyệt riêng.
CREATE OR REPLACE FUNCTION public.admin_publish_asset_3d_model(_scan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_scan   public.asset_3d_scans%ROWTYPE;
  v_review TEXT;
BEGIN
  IF NOT public.admin_has_permission('tai-san-tu-nguyen', 'approve') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  SELECT * INTO v_scan FROM public.asset_3d_scans WHERE id = _scan_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'scan_not_found');
  END IF;
  IF v_scan.status <> 'ready' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_scan.status);
  END IF;

  SELECT review_status INTO v_review FROM public.asset_postings WHERE id = v_scan.asset_posting_id;
  IF v_review IS DISTINCT FROM 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_not_approved');
  END IF;

  UPDATE public.asset_3d_scans SET published_at = COALESCE(published_at, now()) WHERE id = _scan_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_publish_asset_3d_model(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_publish_asset_3d_model(UUID) TO authenticated;

-- ─── Đọc công khai: model của các lô trong một phiên (BR-3D-03) ──────────────
-- RLS chỉ lọc dòng, không che cột ⇒ trang công khai đi qua RPC trả đúng 4 cột.

CREATE OR REPLACE FUNCTION public.public_session_lot_3d_models(_session_id UUID)
RETURNS TABLE (item_id UUID, model_url TEXT, poster_url TEXT, format TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, m.model_url, m.poster_url, m.format
    FROM public.auction_session_items i
    JOIN public.auction_sessions s
      ON s.id = i.session_id AND s.status IN ('published', 'cancelled')
    JOIN public.asset_postings p
      ON p.id = i.asset_posting_id AND p.review_status = 'approved'
    JOIN public.asset_3d_scans m
      ON m.asset_posting_id = i.asset_posting_id
     AND m.status = 'ready'
     AND m.published_at IS NOT NULL
   WHERE i.session_id = _session_id;
$$;

GRANT EXECUTE ON FUNCTION public.public_session_lot_3d_models(UUID) TO anon, authenticated;

-- ─── Storage: model mẫu của đối tác giả lập ──────────────────────────────────
-- Bucket công khai, KHÔNG có policy ghi cho user: chỉ service_role tải file lên.
-- asset-media giữ nguyên giới hạn 10MB + MIME ảnh/video (cố ý), nên model ở bucket riêng.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('asset-3d', 'asset-3d', true, 52428800,
        ARRAY['model/gltf-binary', 'model/vnd.usdz+zip', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
