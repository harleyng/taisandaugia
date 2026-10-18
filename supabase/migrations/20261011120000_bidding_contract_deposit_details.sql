-- Chi tiết tiền đặt trước trên hồ sơ tham gia (design "Phien Dau Gia - Cong Cong Ty",
-- pdg-hoso.js): hình thức nộp, mã giao dịch / số chứng từ để đối soát sao kê, và
-- ngày nhận do chuyên viên nhập (tiền về tài khoản trước khi họ kịp ghi nhận).
--
-- Chứng từ (tệp UNC / biên lai) CHƯA làm — cần bucket riêng theo tổ chức.
--
-- org_set_contract_deposit đổi chữ ký (thêm 3 tham số có mặc định) ⇒ DROP bản
-- 4 tham số rồi tạo lại; gọi theo tên tham số nên client cũ vẫn chạy. Thân hàm là
-- bản LIVE (20261008100300, đã đối chiếu pg_get_functiondef 2026-10-11) + phần mới.

ALTER TABLE public.auction_bidding_contracts
  ADD COLUMN IF NOT EXISTS deposit_method  TEXT,
  ADD COLUMN IF NOT EXISTS deposit_txn_ref TEXT;

ALTER TABLE public.auction_bidding_contracts
  DROP CONSTRAINT IF EXISTS abc_deposit_method_check,
  ADD CONSTRAINT abc_deposit_method_check
    CHECK (deposit_method IS NULL OR deposit_method IN ('bank_transfer', 'cash', 'bank_guarantee')),
  DROP CONSTRAINT IF EXISTS abc_deposit_txn_ref_len,
  ADD CONSTRAINT abc_deposit_txn_ref_len
    CHECK (deposit_txn_ref IS NULL OR char_length(deposit_txn_ref) BETWEEN 1 AND 100);

COMMENT ON COLUMN public.auction_bidding_contracts.deposit_method IS
  'Hình thức nộp tiền đặt trước: bank_transfer | cash | bank_guarantee (null = chưa ghi).';
COMMENT ON COLUMN public.auction_bidding_contracts.deposit_txn_ref IS
  'Mã giao dịch / số chứng từ tiền đặt trước — bắt buộc khi chuyển khoản (đối soát sao kê).';

DROP FUNCTION IF EXISTS public.org_set_contract_deposit(UUID, TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.org_set_contract_deposit(
  _contract_id UUID,
  _status      TEXT,
  _amount      NUMERIC DEFAULT NULL,
  _note        TEXT DEFAULT NULL,
  _method      TEXT DEFAULT NULL,
  _txn_ref     TEXT DEFAULT NULL,
  _received_at TIMESTAMPTZ DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c        RECORD;
  v_ok     BOOLEAN;
  v_amount NUMERIC;
  v_ref    TEXT := NULLIF(btrim(COALESCE(_txn_ref, '')), '');
BEGIN
  SELECT x.*, s.status AS session_status INTO c
    FROM public.auction_bidding_contracts x
    JOIN public.auction_sessions s ON s.id = x.session_id
   WHERE x.id = _contract_id
   FOR UPDATE OF x;
  IF c.id IS NULL OR NOT public.can_manage_bidding_contracts(c.organization_id, 'update') THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ, hoặc bạn không có quyền cập nhật.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF c.status = 'refunded' OR c.review_status = 'rejected' THEN
    RAISE EXCEPTION 'Hồ sơ đã bị từ chối — không ghi nhận tiền đặt trước.' USING ERRCODE = 'check_violation';
  END IF;
  IF c.status <> 'paid' THEN
    RAISE EXCEPTION 'Chỉ cập nhật tiền đặt trước cho hồ sơ đã thanh toán.' USING ERRCODE = 'check_violation';
  END IF;
  IF c.absent_at IS NOT NULL THEN
    RAISE EXCEPTION 'Người tham gia vắng mặt — dùng "Miễn trừ vắng mặt" nếu có lý do chính đáng.' USING ERRCODE = 'check_violation';
  END IF;
  IF _status NOT IN ('pending', 'received', 'refunded', 'forfeited') THEN
    RAISE EXCEPTION 'Trạng thái tiền đặt trước không hợp lệ.' USING ERRCODE = 'check_violation';
  END IF;
  IF _status = 'pending' AND c.checked_in_at IS NOT NULL THEN
    RAISE EXCEPTION 'Người tham gia đã điểm danh — không lùi tiền đặt trước về "chưa nhận" được.' USING ERRCODE = 'check_violation';
  END IF;

  v_ok := (_status = c.deposit_status AND _status = 'received')
       OR (c.deposit_status = 'pending'  AND _status = 'received')
       OR (c.deposit_status = 'received' AND _status IN ('pending', 'refunded', 'forfeited'))
       OR (c.deposit_status IN ('refunded', 'forfeited') AND _status = 'received');
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Không thể chuyển tiền đặt trước từ "%" sang "%".', c.deposit_status, _status
      USING ERRCODE = 'check_violation';
  END IF;

  IF c.session_status = 'cancelled' AND NOT (c.deposit_status = 'received' AND _status = 'refunded') THEN
    RAISE EXCEPTION 'Phiên đã huỷ — chỉ ghi nhận hoàn trả tiền đặt trước.' USING ERRCODE = 'check_violation';
  END IF;

  v_amount := CASE WHEN _status = 'pending' THEN NULL ELSE COALESCE(_amount, c.deposit_amount_received) END;
  IF _status <> 'pending' AND COALESCE(v_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Nhập số tiền đặt trước đã nhận.' USING ERRCODE = 'check_violation';
  END IF;
  IF _status = 'forfeited' AND btrim(COALESCE(_note, '')) = '' THEN
    RAISE EXCEPTION 'Nhập lý do không hoàn trả tiền đặt trước.' USING ERRCODE = 'check_violation';
  END IF;

  -- Phần mới (20261011120000): chi tiết khoản nộp — chỉ đi kèm "đã nhận".
  IF _method IS NOT NULL AND _method NOT IN ('bank_transfer', 'cash', 'bank_guarantee') THEN
    RAISE EXCEPTION 'Hình thức nộp tiền đặt trước không hợp lệ.' USING ERRCODE = 'check_violation';
  END IF;
  IF _status = 'received' AND _method = 'bank_transfer' AND v_ref IS NULL THEN
    RAISE EXCEPTION 'Nhập mã giao dịch để đối soát sao kê.' USING ERRCODE = 'check_violation';
  END IF;
  IF _received_at IS NOT NULL AND _received_at > now() + interval '1 day' THEN
    RAISE EXCEPTION 'Ngày nhận tiền đặt trước không được ở tương lai.' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.auction_bidding_contracts
     SET deposit_status            = _status,
         deposit_amount_received   = v_amount,
         deposit_received_at       = CASE
                                       WHEN _status = 'pending' THEN NULL
                                       WHEN _status = 'received' AND _received_at IS NOT NULL THEN _received_at
                                       WHEN c.deposit_status = 'pending' THEN now()
                                       ELSE deposit_received_at
                                     END,
         deposit_method            = CASE
                                       WHEN _status = 'pending' THEN NULL
                                       WHEN _status = 'received' AND _method IS NOT NULL THEN _method
                                       ELSE deposit_method
                                     END,
         deposit_txn_ref           = CASE
                                       WHEN _status = 'pending' THEN NULL
                                       WHEN _status = 'received' AND _method IS NOT NULL THEN v_ref
                                       ELSE deposit_txn_ref
                                     END,
         deposit_status_changed_at = now(),
         deposit_note              = CASE WHEN _note IS NULL THEN deposit_note ELSE NULLIF(btrim(_note), '') END,
         deposit_updated_by        = auth.uid(),
         bidder_no                 = CASE WHEN _status = 'pending' THEN NULL ELSE bidder_no END,
         bidder_no_assigned_at     = CASE WHEN _status = 'pending' THEN NULL ELSE bidder_no_assigned_at END
   WHERE id = c.id;
END; $$;

REVOKE ALL ON FUNCTION public.org_set_contract_deposit(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_set_contract_deposit(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

NOTIFY pgrst, 'reload schema';
