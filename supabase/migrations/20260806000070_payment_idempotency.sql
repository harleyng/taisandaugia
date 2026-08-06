-- ─────────────────────────────────────────────────────────────────────────────
-- Chống cộng/trừ credit HAI LẦN cho cùng một giao dịch thanh toán.
--
-- VẤN ĐỀ: /payment-result là nơi DUY NHẤT cộng credit và tự mở khoá sau khi
-- thanh toán. Nó chỉ được bảo vệ bởi một `useRef` phía client, thứ chỉ chặn
-- được double-invoke TRONG CÙNG một lần mount. Người dùng F5, hoặc bấm back rồi
-- forward, là mount mới ⇒ ref reset ⇒ chạy lại toàn bộ:
--   • addCredits cộng thêm một lần nữa (không có khoá idempotent nào);
--   • unlockCompany/unlockOwner TRỪ credit lần nữa và cộng dồn thêm thời hạn
--     (stacking là tính năng có chủ đích, nên nó không tự chặn trùng).
-- Mã đơn hàng ở VnpayCheckout sinh bằng Math.random() và KHÔNG được truyền sang
-- /payment-result, nên trước đây không có gì để đối chiếu.
--
-- CÁCH SỬA: một bảng "vé" ghi nhận mã giao dịch đã xử lý, cấp qua RPC atomic.
-- Ai gọi trước được vé, mọi lượt sau bị từ chối ⇒ client bỏ qua toàn bộ việc
-- cộng credit/mở khoá. Đặt khoá ở SERVER vì đây là tiền: guard phía client
-- không sống qua được F5.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_claims (
  -- Mã giao dịch từ URL /payment-result. PK chính là cơ chế chống trùng.
  txn_ref    TEXT PRIMARY KEY CHECK (btrim(txn_ref) <> ''),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Gói/hành động đã xử lý — để đối soát khi khách khiếu nại.
  variant_key TEXT,
  unlock_param TEXT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_claims_user
  ON public.payment_claims (user_id, claimed_at DESC);

ALTER TABLE public.payment_claims ENABLE ROW LEVEL SECURITY;

-- Dữ liệu CÁ NHÂN → quy ước "own rows".
DROP POLICY IF EXISTS payment_claims_own ON public.payment_claims;
CREATE POLICY payment_claims_own ON public.payment_claims
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

/**
 * Nhận vé xử lý một giao dịch. TRUE = lần đầu, hãy cộng credit / mở khoá.
 * FALSE = đã xử lý rồi, BỎ QUA.
 *
 * ON CONFLICT DO NOTHING + RETURNING làm việc chống trùng nguyên tử ở tầng DB:
 * hai tab cùng F5 một lúc thì chỉ đúng một tab nhận được TRUE.
 *
 * SECURITY DEFINER nhưng vẫn chốt _user_id = auth.uid() bên trong, để không ai
 * nhận vé hộ người khác.
 */
CREATE OR REPLACE FUNCTION public.claim_payment_txn(
  _txn_ref      TEXT,
  _variant_key  TEXT DEFAULT NULL,
  _unlock_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _inserted TEXT;
BEGIN
  IF _uid IS NULL OR _txn_ref IS NULL OR btrim(_txn_ref) = '' THEN
    RETURN false;
  END IF;

  INSERT INTO public.payment_claims (txn_ref, user_id, variant_key, unlock_param)
  VALUES (btrim(_txn_ref), _uid, _variant_key, _unlock_param)
  ON CONFLICT (txn_ref) DO NOTHING
  RETURNING txn_ref INTO _inserted;

  RETURN _inserted IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_payment_txn(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_payment_txn(TEXT, TEXT, TEXT) TO authenticated;
