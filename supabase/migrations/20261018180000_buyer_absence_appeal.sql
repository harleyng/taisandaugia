-- Người mua VẮNG MẶT gửi lý do + giấy tờ chứng minh (design "San - Ho So Tham
-- Gia" 979d4c55, thẻ "Bạn đã vắng mặt" → "Gửi lý do vắng mặt").
--
-- Chỉ là ĐỀ NGHỊ: miễn trừ + hoàn tiền đặt trước vẫn do tổ chức quyết qua
-- org_excuse_absence (cổng tổ chức, tab Điểm danh hiện lý do người mua gửi).
-- Gửi lại được (ghi đè) cho tới khi tổ chức đã miễn trừ.

ALTER TABLE public.auction_bidding_contracts
  ADD COLUMN IF NOT EXISTS absence_appeal_note TEXT,
  ADD COLUMN IF NOT EXISTS absence_appeal_path TEXT,
  ADD COLUMN IF NOT EXISTS absence_appeal_at   TIMESTAMPTZ;

COMMENT ON COLUMN public.auction_bidding_contracts.absence_appeal_note IS
  'Lý do vắng mặt người mua gửi (đề nghị miễn trừ). Chỉ ghi qua buyer_submit_absence_appeal.';
COMMENT ON COLUMN public.auction_bidding_contracts.absence_appeal_path IS
  'Giấy tờ chứng minh lý do vắng (bucket buyer-kyc, thư mục {user_id}/) — không bắt buộc.';

CREATE OR REPLACE FUNCTION public.buyer_submit_absence_appeal(_contract_id UUID, _note TEXT, _proof_path TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_note TEXT := NULLIF(btrim(COALESCE(_note, '')), '');
  v_path TEXT := NULLIF(btrim(COALESCE(_proof_path, '')), '');
  c      RECORD;
  v_at   TIMESTAMPTZ;
BEGIN
  SELECT id, user_id, status, absent_at, absence_excused_at, deposit_status
    INTO c
    FROM public.auction_bidding_contracts
   WHERE id = _contract_id
   FOR UPDATE;
  IF v_uid IS NULL OR c.id IS NULL OR c.user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.status <> 'paid' OR c.absent_at IS NULL THEN
    RAISE EXCEPTION 'Hồ sơ không bị ghi vắng mặt.' USING ERRCODE = 'check_violation';
  END IF;
  IF c.absence_excused_at IS NOT NULL THEN
    RAISE EXCEPTION 'Tổ chức đã chấp nhận lý do vắng mặt của bạn.' USING ERRCODE = 'check_violation';
  END IF;
  IF length(COALESCE(v_note, '')) < 10 THEN
    RAISE EXCEPTION 'Lý do vắng mặt cần ít nhất 10 ký tự.' USING ERRCODE = 'check_violation';
  END IF;
  IF length(v_note) > 2000 THEN
    RAISE EXCEPTION 'Lý do vắng mặt tối đa 2.000 ký tự.' USING ERRCODE = 'check_violation';
  END IF;
  IF v_path IS NOT NULL AND (
       split_part(v_path, '/', 1) <> v_uid::text
       OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'buyer-kyc' AND o.name = v_path)) THEN
    RAISE EXCEPTION 'Giấy tờ không hợp lệ — vui lòng tải lại.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.auction_bidding_contracts
     SET absence_appeal_note = v_note,
         absence_appeal_path = COALESCE(v_path, absence_appeal_path),
         absence_appeal_at   = now()
   WHERE id = _contract_id
   RETURNING absence_appeal_at INTO v_at;

  RETURN jsonb_build_object('contract_id', _contract_id, 'appealed_at', v_at);
END; $$;

REVOKE ALL ON FUNCTION public.buyer_submit_absence_appeal(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buyer_submit_absence_appeal(UUID, TEXT, TEXT) TO authenticated;

-- Giấy tờ chứng minh: tổ chức đọc được như chứng từ đặt trước; người mua không
-- xoá được khi còn tham chiếu. Vá trên bản LIVE (mốc = cột thêm ở 20261018160000).
DO $patch$
DECLARE
  v_def    TEXT := pg_get_functiondef('public.can_read_buyer_kyc_object(text)'::regprocedure);
  v_anchor TEXT := 'c.poa_doc_path, c.deposit_proof_path)';
BEGIN
  IF position('absence_appeal_path' IN v_def) > 0 THEN RETURN; END IF;
  IF position(v_anchor IN v_def) = 0 THEN
    RAISE EXCEPTION 'can_read_buyer_kyc_object: không thấy mốc — bản LIVE đã đổi, vá tay';
  END IF;
  EXECUTE replace(v_def, v_anchor, 'c.poa_doc_path, c.deposit_proof_path, c.absence_appeal_path)');
END $patch$;

DO $patch$
DECLARE
  v_def    TEXT := pg_get_functiondef('public.buyer_kyc_path_referenced(text)'::regprocedure);
  v_anchor TEXT := 'c.poa_doc_path, c.deposit_proof_path)';
BEGIN
  IF position('absence_appeal_path' IN v_def) > 0 THEN RETURN; END IF;
  IF position(v_anchor IN v_def) = 0 THEN
    RAISE EXCEPTION 'buyer_kyc_path_referenced: không thấy mốc — bản LIVE đã đổi, vá tay';
  END IF;
  EXECUTE replace(v_def, v_anchor, 'c.poa_doc_path, c.deposit_proof_path, c.absence_appeal_path)');
END $patch$;
