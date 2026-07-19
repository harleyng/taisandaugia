-- Nhà cung cấp (suppliers) + dịch vụ hoa hồng (services.kind = 'commission').
--
-- suppliers = bên cung cấp dịch vụ mà sàn môi giới và ăn hoa hồng. TÁCH RIÊNG
-- khỏi `partners` một cách có chủ ý: `partners` là CMS thẻ trang chủ và có
-- policy public_read cho anon; RLS của Postgres lọc theo DÒNG chứ không theo
-- CỘT, nên gộp số tài khoản / MST / % hoa hồng vào đó = phát tán ra trang chủ
-- ẩn danh ngay lần tải đầu (usePublicPartners gọi .select("*")).
--
-- "Hiển thị trên sàn" biểu diễn bằng CẤU TRÚC chứ không bằng cờ:
--   suppliers.partner_id IS NULL     → quan hệ ngầm (chỉ back-office biết)
--   suppliers.partner_id IS NOT NULL → có thẻ hiển thị ở carousel trang chủ
--
-- Giá & điều khoản hoa hồng nằm ở service_variants (ngang hàng với giá — biến
-- thể vốn đã là nguồn giá). suppliers.default_commission_* CHỈ để form điền sẵn,
-- KHÔNG có chuỗi fallback lúc chạy: đơn hàng phải tự mang điều khoản của nó.

-- ─── suppliers (Nhà cung cấp) ────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.supplier_code_seq START 1;

CREATE TABLE public.suppliers (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code                    TEXT          UNIQUE,                        -- 'NC000001'
  name                    TEXT          NOT NULL,
  supplier_type           TEXT          NOT NULL DEFAULT 'company'
                            CHECK (supplier_type IN ('individual', 'company')),
  contact_name            TEXT,
  phone                   TEXT,
  email                   TEXT,
  tax_code                TEXT,
  address                 TEXT,
  bank_name               TEXT,
  bank_account            TEXT,
  default_commission_type TEXT
                            CHECK (default_commission_type IS NULL
                                   OR default_commission_type IN ('percent', 'fixed')),
  default_commission_rate NUMERIC(12,2)
                            CHECK (default_commission_rate IS NULL
                                   OR default_commission_rate > 0),
  -- Thẻ hiển thị trên trang chủ; NULL = quan hệ ngầm.
  partner_id              UUID          REFERENCES public.partners(id) ON DELETE RESTRICT,
  note                    TEXT,
  status                  TEXT          NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive')),
  created_by              UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- % thì phải nằm trong 0–100; 'fixed' là số tiền tuyệt đối nên không chặn trần.
  CONSTRAINT suppliers_default_pct_check
    CHECK (default_commission_type IS DISTINCT FROM 'percent'
           OR (default_commission_rate > 0 AND default_commission_rate <= 100))
);

CREATE INDEX idx_suppliers_status ON public.suppliers (status, created_at DESC);
-- Một thẻ trang chủ ↔ tối đa một nhà cung cấp.
CREATE UNIQUE INDEX idx_suppliers_partner
  ON public.suppliers (partner_id) WHERE partner_id IS NOT NULL;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- CHỈ admin. Cố ý KHÔNG có public_read: bảng chứa MST, số tài khoản, biên hoa hồng.
CREATE POLICY "suppliers_admin_all"
  ON public.suppliers FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE OR REPLACE FUNCTION public.set_supplier_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'NC' || lpad(nextval('public.supplier_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER suppliers_set_code
  BEFORE INSERT ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_supplier_code();

CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── services: thêm loại 'commission' ────────────────────────────────────────

-- Dò tên ràng buộc thật thay vì hardcode (tên do PG tự đặt, có thể khác giữa
-- các môi trường nếu bảng từng được tạo lại).
DO $$
DECLARE v_name TEXT;
BEGIN
  SELECT conname INTO v_name
  FROM pg_constraint
  WHERE conrelid = 'public.services'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%kind%';
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.services DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.services
  ADD CONSTRAINT services_kind_check
    CHECK (kind IN ('credit', 'direct', 'commission'));

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT;

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_commission_requires_supplier;
ALTER TABLE public.services
  ADD CONSTRAINT services_commission_requires_supplier
    CHECK (kind <> 'commission' OR supplier_id IS NOT NULL);

-- Chặn trạng thái nhập nhằng kind='commission' + category='package' mà form
-- biến thể không xử lý được.
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_commission_category;
ALTER TABLE public.services
  ADD CONSTRAINT services_commission_category
    CHECK (kind <> 'commission' OR category = 'brokerage');

CREATE INDEX IF NOT EXISTS idx_services_supplier
  ON public.services (supplier_id) WHERE supplier_id IS NOT NULL;

-- Dịch vụ hoa hồng là chuyện nội bộ giữa sàn và NCC — không lộ ra catalog công khai.
DROP POLICY IF EXISTS "services_public_read" ON public.services;
CREATE POLICY "services_public_read"
  ON public.services FOR SELECT
  USING (is_active = true AND kind <> 'commission');

-- Đổi `kind` sau khi đã có đơn sẽ làm báo cáo tách nguồn sai hồi tố
-- (đơn giữ snapshot service_kind của thời điểm chốt).
CREATE OR REPLACE FUNCTION public.services_block_kind_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.kind IS DISTINCT FROM NEW.kind
     AND EXISTS (SELECT 1 FROM public.orders WHERE service_id = NEW.id) THEN
    RAISE EXCEPTION 'Không đổi loại dịch vụ khi đã có đơn hàng'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER services_block_kind_change
  BEFORE UPDATE OF kind ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.services_block_kind_change();

-- ─── service_variants: điều khoản hoa hồng ───────────────────────────────────

ALTER TABLE public.service_variants
  ADD COLUMN IF NOT EXISTS commission_type  TEXT,
  ADD COLUMN IF NOT EXISTS commission_value NUMERIC(12,2);

ALTER TABLE public.service_variants DROP CONSTRAINT IF EXISTS service_variants_commission_type_check;
ALTER TABLE public.service_variants
  ADD CONSTRAINT service_variants_commission_type_check
    CHECK (commission_type IS NULL OR commission_type IN ('percent', 'fixed'));

ALTER TABLE public.service_variants DROP CONSTRAINT IF EXISTS service_variants_commission_pct_check;
ALTER TABLE public.service_variants
  ADD CONSTRAINT service_variants_commission_pct_check
    CHECK (commission_type IS DISTINCT FROM 'percent'
           OR (commission_value > 0 AND commission_value <= 100));

-- Có commission_type ⇒ phải có giá trị đi kèm.
ALTER TABLE public.service_variants DROP CONSTRAINT IF EXISTS service_variants_commission_pair_check;
ALTER TABLE public.service_variants
  ADD CONSTRAINT service_variants_commission_pair_check
    CHECK (commission_type IS NULL OR commission_value IS NOT NULL);

-- Vị từ MỘT BẢNG, cố ý không EXISTS sang services: subquery trong policy phải
-- chịu RLS của bảng được tham chiếu, và cả hai fetcher công khai đã dùng
-- services!inner nên EXISTS vừa thừa vừa làm khả kiến phụ thuộc policy khác.
DROP POLICY IF EXISTS "service_variants_public_read" ON public.service_variants;
CREATE POLICY "service_variants_public_read"
  ON public.service_variants FOR SELECT
  USING (is_active = true AND commission_type IS NULL);
