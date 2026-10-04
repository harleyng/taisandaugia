-- ⏸ CHƯA ÁP — cố ý để NGOÀI supabase/migrations/ (mọi `db push` của phiên khác sẽ
-- áp ngay file trong đó). Khi giao diện "đồng ý trước khi trả" đã lên production:
-- chuyển file vào supabase/migrations/<timestamp>_service_contract_payment_gate.sql
-- rồi áp. Đã nghiệm thu bằng BEGIN…ROLLBACK 2026-09-27 (chặn khi chưa đồng ý,
-- cho qua khi đã đồng ý đúng báo giá).

-- Cổng thanh toán hợp đồng cung ứng dịch vụ (HDCU): KHÔNG trả được đơn VR tour /
-- giám định / tư vấn pháp lý / tư vấn đấu giá khi chưa ĐỒNG Ý hợp đồng của đúng
-- báo giá đang trả (cùng quoted_at + quoted_price).
--
-- Trigger (không viết lại 4 hàm _settle_*): bắt đúng khoảnh khắc paid_at NULL →
-- có giá trị, nên phủ cả cổng thanh toán thật (IPN) sau này. RAISE làm rollback
-- luôn dòng payment_claims ⇒ mã giao dịch còn dùng lại được. Cổng UX chính ở
-- client (useCheckoutItem không cho vào VNPay khi chưa đồng ý) — đây là lưới cuối.
--
-- ⚠️ Áp SAU khi giao diện "đồng ý trước khi trả" đã lên production: DB dùng chung,
-- áp sớm là mọi đơn đang báo giá không trả được từ bản production cũ.

CREATE OR REPLACE FUNCTION public.service_order_require_contract()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.service_contracts sc
     WHERE sc.service_kind = TG_ARGV[0]
       AND sc.order_id = NEW.id
       AND sc.quoted_at = OLD.quoted_at
       AND sc.price = OLD.quoted_price
  ) THEN
    RAISE EXCEPTION 'Chưa đồng ý hợp đồng dịch vụ cho báo giá này — mở đơn, đọc và đồng ý hợp đồng trước khi thanh toán.'
      USING ERRCODE = 'P0001', HINT = 'SC_NOT_ACCEPTED';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER asset_vr_tour_orders_require_contract
  BEFORE UPDATE OF paid_at ON public.asset_vr_tour_orders
  FOR EACH ROW WHEN (OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL)
  EXECUTE FUNCTION public.service_order_require_contract('vr-tour');

CREATE TRIGGER asset_authentication_orders_require_contract
  BEFORE UPDATE OF paid_at ON public.asset_authentication_orders
  FOR EACH ROW WHEN (OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL)
  EXECUTE FUNCTION public.service_order_require_contract('giam-dinh');

CREATE TRIGGER asset_legal_consultations_require_contract
  BEFORE UPDATE OF paid_at ON public.asset_legal_consultations
  FOR EACH ROW WHEN (OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL)
  EXECUTE FUNCTION public.service_order_require_contract('tu-van-phap-ly');

CREATE TRIGGER asset_auction_consultations_require_contract
  BEFORE UPDATE OF paid_at ON public.asset_auction_consultations
  FOR EACH ROW WHEN (OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL)
  EXECUTE FUNCTION public.service_order_require_contract('tu-van-dau-gia');

CREATE TRIGGER asset_valuation_orders_require_contract
  BEFORE UPDATE OF paid_at ON public.asset_valuation_orders
  FOR EACH ROW WHEN (OLD.paid_at IS NULL AND NEW.paid_at IS NOT NULL)
  EXECUTE FUNCTION public.service_order_require_contract('tham-dinh');
