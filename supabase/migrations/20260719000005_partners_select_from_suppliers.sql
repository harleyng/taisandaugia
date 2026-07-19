-- Phân vai lại giữa `suppliers` và `partners` để hết trùng lặp nhập liệu.
--
-- Trước: hai màn hình cùng quản lý "công ty mình làm việc cùng" — một công ty
-- vừa hiện logo trang chủ vừa nhận hoa hồng phải nhập 2 lần, đồng bộ tay.
--
-- Sau — mỗi bảng một vai, không chồng lấn:
--   suppliers = SỔ ĐĂNG KÝ CÔNG TY duy nhất (nhãn UI: "Đối tác").
--               Nơi duy nhất nhập tên/liên hệ/MST/ngân hàng/% hoa hồng.
--   partners  = THẺ TRÌNH BÀY trên trang chủ (nhãn UI: "Hiển thị trên sàn").
--               Tạo thẻ bằng cách CHỌN RA từ suppliers, không gõ lại công ty.
--
-- Vì vậy đảo chiều quan hệ: partners.supplier_id (thẻ trỏ về công ty) thay cho
-- suppliers.partner_id (công ty trỏ về thẻ) — đúng chiều tác nghiệp "chọn từ
-- đối tác ra để hiển thị".
--
-- Ghi chú bảo mật: cột nhạy cảm (bank_account, tax_code, default_commission_*)
-- CHỈ nằm ở suppliers — bảng admin-only, không có public_read. `partners` vẫn
-- giữ policy công khai vì nó thuần cột trình bày. Do đó không cần thêm lớp RPC:
-- việc tách đã nằm sẵn ở ranh giới hai bảng.

-- ─── partners: trỏ về công ty trong sổ đăng ký ───────────────────────────────

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT;

-- Một công ty ↔ tối đa một thẻ hiển thị.
CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_supplier
  ON public.partners (supplier_id) WHERE supplier_id IS NOT NULL;

-- Chuyển liên kết cũ sang chiều mới trước khi bỏ cột.
UPDATE public.partners p
   SET supplier_id = s.id
  FROM public.suppliers s
 WHERE s.partner_id = p.id
   AND p.supplier_id IS NULL;

DROP INDEX IF EXISTS public.idx_suppliers_partner;
ALTER TABLE public.suppliers DROP COLUMN IF EXISTS partner_id;

-- ─── Kiểm chứng: không mất liên kết nào khi đảo chiều ────────────────────────
DO $$
DECLARE v_linked INTEGER;
BEGIN
  SELECT count(*) INTO v_linked FROM public.partners WHERE supplier_id IS NOT NULL;
  IF v_linked < 1 THEN
    RAISE EXCEPTION 'Đảo chiều liên kết thất bại: không thẻ nào trỏ về đối tác';
  END IF;
END $$;
