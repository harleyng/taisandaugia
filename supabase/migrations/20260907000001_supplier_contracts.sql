-- Hợp đồng hợp tác giữa sàn và đối tác (chủ yếu là tổ chức đấu giá).
--
-- Hợp đồng được ký NGOÀI nền tảng; ở đây chỉ ghi nhận số HĐ, thời hạn, bản scan
-- và — quan trọng nhất — MỨC HOA HỒNG THEO TỪNG DỊCH VỤ.
--
-- Vì sao phải là bảng riêng, không nhét thêm cột vào chỗ đã có:
--
--   1. `suppliers.default_commission_*` (20260719000002) chỉ là giá trị ĐIỀN SẴN
--      cho form. Một công ty hợp tác qua nhiều dịch vụ cùng lúc thì một cặp cột
--      không chứa nổi nhiều mức khác nhau.
--   2. `service_variants.commission_*` không có THỜI HẠN HIỆU LỰC. Tái ký với
--      mức mới sẽ ghi đè mức cũ ⇒ mất lịch sử, và đơn hàng cũ không còn giải
--      thích được vì sao mang con số đó.
--
-- Vì vậy: hợp đồng là ĐẦU (thời hạn, số HĐ, người ký, bản scan), còn dòng hợp
-- đồng là mức hoa hồng của TỪNG dịch vụ.
--   Một đối tác → nhiều hợp đồng (tái ký theo năm) → mỗi hợp đồng nhiều dịch vụ.
--
-- ⚠️ Hợp đồng KHÔNG thay thế quy tắc "đơn tự mang điều khoản của nó"
-- (20260719000002): `orders.commission_type/value` vẫn là ẢNH CHỤP tại thời điểm
-- chốt. Hợp đồng là nguồn điền sẵn CÓ THẨM QUYỀN + dấu vết truy nguyên, không
-- phải thứ báo cáo đọc lúc chạy.

-- ─── 1. suppliers → tổ chức đấu giá: cây cầu còn thiếu ───────────────────────
-- Không có cột này thì không tra ngược được từ "tổ chức nào thắng ký gửi" sang
-- "hợp đồng nào đang hiệu lực với họ". `organizations.auction_org_id`
-- (20260906100001) đã nối tài khoản KYC ↔ danh bạ; đây là mảnh còn lại.

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS auction_org_id UUID
    REFERENCES public.auction_organizations(id) ON DELETE SET NULL;

-- Một tổ chức đấu giá ↔ tối đa một hồ sơ đối tác. Hai hồ sơ cùng trỏ một tổ chức
-- thì resolver hoa hồng mất tính xác định.
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_auction_org
  ON public.suppliers (auction_org_id) WHERE auction_org_id IS NOT NULL;

-- ─── 2. supplier_contracts (đầu hợp đồng) ────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.supplier_contract_code_seq START 1;

CREATE TABLE IF NOT EXISTS public.supplier_contracts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT        UNIQUE,                     -- 'HD000001' (mã nội bộ)
  supplier_id     UUID        NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  contract_no     TEXT        NOT NULL,                   -- số hợp đồng ngoài đời
  title           TEXT,
  signed_date     DATE        NOT NULL,
  effective_from  DATE        NOT NULL,
  effective_to    DATE,                                   -- NULL = vô thời hạn
  signer_name     TEXT,                                   -- người ký bên đối tác
  signer_title    TEXT,
  our_signer_name TEXT,                                   -- người ký bên sàn
  doc_path        TEXT,                                   -- bucket contract-documents
  -- "Hết hạn" KHÔNG phải giá trị lưu ở đây: nó suy ra từ effective_to < today.
  -- Lưu thành cờ thì phải nuôi một cron để lật, và cờ sẽ lệch ngay lần quên đầu.
  status          TEXT        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'active', 'terminated')),
  note            TEXT,
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supplier_contracts_period_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_supplier_contracts_supplier
  ON public.supplier_contracts (supplier_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_contracts_status
  ON public.supplier_contracts (status, effective_to);

ALTER TABLE public.supplier_contracts ENABLE ROW LEVEL SECURITY;

-- CHỈ admin. Cùng lý do như `suppliers`: biên hoa hồng là bí mật thương mại, và
-- RLS lọc theo DÒNG chứ không giấu được CỘT.
DROP POLICY IF EXISTS "supplier_contracts_admin_all" ON public.supplier_contracts;
CREATE POLICY "supplier_contracts_admin_all"
  ON public.supplier_contracts FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE OR REPLACE FUNCTION public.set_supplier_contract_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'HD' || lpad(nextval('public.supplier_contract_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS supplier_contracts_set_code ON public.supplier_contracts;
CREATE TRIGGER supplier_contracts_set_code
  BEFORE INSERT ON public.supplier_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_supplier_contract_code();

DROP TRIGGER IF EXISTS supplier_contracts_updated_at ON public.supplier_contracts;
CREATE TRIGGER supplier_contracts_updated_at
  BEFORE UPDATE ON public.supplier_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 3. supplier_contract_lines (một dòng = một hợp tác qua một dịch vụ) ─────

CREATE TABLE IF NOT EXISTS public.supplier_contract_lines (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id        UUID          NOT NULL REFERENCES public.supplier_contracts(id) ON DELETE CASCADE,
  service_id         UUID          NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  -- NULL = áp cho MỌI biến thể của dịch vụ. Có giá trị = mức riêng cho biến thể đó.
  service_variant_id UUID          REFERENCES public.service_variants(id) ON DELETE RESTRICT,
  commission_type    TEXT          NOT NULL
                       CHECK (commission_type IN ('percent', 'fixed')),
  commission_value   NUMERIC(12,2) NOT NULL CHECK (commission_value > 0),
  note               TEXT,
  is_active          BOOLEAN       NOT NULL DEFAULT true,
  sort_order         INTEGER       NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- % phải nằm trong 0–100; 'fixed' là số tiền tuyệt đối nên không chặn trần.
  -- Soi gương service_variants_commission_pct_check (20260719000002).
  CONSTRAINT supplier_contract_lines_pct_check
    CHECK (commission_type <> 'percent' OR commission_value <= 100)
);

CREATE INDEX IF NOT EXISTS idx_scl_contract
  ON public.supplier_contract_lines (contract_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_scl_service
  ON public.supplier_contract_lines (service_id);

-- Trong MỘT hợp đồng, mỗi (dịch vụ, biến thể) chỉ được nêu một lần. Hai dòng
-- trùng nhau thì không biết dòng nào là mức đã thỏa thuận.
CREATE UNIQUE INDEX IF NOT EXISTS idx_scl_unique_variant
  ON public.supplier_contract_lines (contract_id, service_id, service_variant_id)
  WHERE service_variant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_scl_unique_service
  ON public.supplier_contract_lines (contract_id, service_id)
  WHERE service_variant_id IS NULL;

ALTER TABLE public.supplier_contract_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_contract_lines_admin_all" ON public.supplier_contract_lines;
CREATE POLICY "supplier_contract_lines_admin_all"
  ON public.supplier_contract_lines FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP TRIGGER IF EXISTS supplier_contract_lines_updated_at ON public.supplier_contract_lines;
CREATE TRIGGER supplier_contract_lines_updated_at
  BEFORE UPDATE ON public.supplier_contract_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── 4. Chặn hai hợp đồng còn hiệu lực cùng phủ một dịch vụ ──────────────────
--
-- Đây là ràng buộc TIỀN, không phải ràng buộc gọn gàng: nếu cùng một đối tác có
-- hai hợp đồng đang hiệu lực cùng nêu "Môi giới ký gửi", resolver không biết lấy
-- mức nào ⇒ số tiền hoa hồng phụ thuộc thứ tự dòng trong bảng. Phải chặn ở DB.
--
-- Hợp đồng 'draft' được miễn: soạn trước hợp đồng năm sau trong lúc hợp đồng năm
-- nay còn chạy là việc bình thường. Chỉ khi chuyển sang 'active' mới bị soi.

CREATE OR REPLACE FUNCTION public.supplier_contracts_assert_no_overlap(_contract_id UUID)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_conflict RECORD;
BEGIN
  SELECT c2.code AS other_code, c2.contract_no AS other_no, s.name AS service_name
    INTO v_conflict
    FROM public.supplier_contracts       c1
    JOIN public.supplier_contract_lines  l1 ON l1.contract_id = c1.id AND l1.is_active
    JOIN public.supplier_contracts       c2 ON c2.supplier_id = c1.supplier_id
                                           AND c2.id <> c1.id
                                           AND c2.status = 'active'
    JOIN public.supplier_contract_lines  l2 ON l2.contract_id = c2.id
                                           AND l2.is_active
                                           AND l2.service_id = l1.service_id
    JOIN public.services                 s  ON s.id = l1.service_id
   WHERE c1.id = _contract_id
     AND c1.status = 'active'
     -- effective_to NULL ⇒ daterange không chặn trên = vô thời hạn.
     AND daterange(c1.effective_from, c1.effective_to, '[]')
      && daterange(c2.effective_from, c2.effective_to, '[]')
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Trùng hợp đồng: dịch vụ "%" đã nằm trong hợp đồng % (số %) còn hiệu lực cùng kỳ',
      v_conflict.service_name, v_conflict.other_code, v_conflict.other_no
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

-- AFTER chứ không BEFORE: hàm kiểm tra tự join lại chính bảng, cần dòng mới đã
-- hiện diện thì mới soi được đúng.
CREATE OR REPLACE FUNCTION public.supplier_contract_lines_guard_overlap()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.supplier_contracts_assert_no_overlap(NEW.contract_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS supplier_contract_lines_guard_overlap ON public.supplier_contract_lines;
CREATE TRIGGER supplier_contract_lines_guard_overlap
  AFTER INSERT OR UPDATE ON public.supplier_contract_lines
  FOR EACH ROW EXECUTE FUNCTION public.supplier_contract_lines_guard_overlap();

-- Gắn cả trên bảng đầu: đổi ngày hiệu lực / bật status='active' cũng tạo ra
-- trùng lặp y hệt. Chỉ gác ở bảng dòng là để hở cửa sau.
CREATE OR REPLACE FUNCTION public.supplier_contracts_guard_overlap()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.supplier_contracts_assert_no_overlap(NEW.id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS supplier_contracts_guard_overlap ON public.supplier_contracts;
CREATE TRIGGER supplier_contracts_guard_overlap
  AFTER UPDATE OF effective_from, effective_to, status, supplier_id
  ON public.supplier_contracts
  FOR EACH ROW EXECUTE FUNCTION public.supplier_contracts_guard_overlap();

-- ─── 5. Kiểm chứng ngay trong migration ──────────────────────────────────────

DO $$
DECLARE
  v_sup UUID;
  v_svc UUID;
  v_c1  UUID;
  v_c2  UUID;
  v_ok  BOOLEAN := false;
BEGIN
  INSERT INTO public.suppliers (name, status)
  VALUES ('__kiemchung_hopdong__', 'inactive') RETURNING id INTO v_sup;

  SELECT id INTO v_svc FROM public.services ORDER BY created_at LIMIT 1;
  IF v_svc IS NULL THEN
    DELETE FROM public.suppliers WHERE id = v_sup;
    RAISE NOTICE 'Bỏ qua kiểm chứng: chưa có dịch vụ nào';
    RETURN;
  END IF;

  INSERT INTO public.supplier_contracts
    (supplier_id, contract_no, signed_date, effective_from, effective_to, status)
  VALUES (v_sup, 'KC-1', DATE '2026-01-01', DATE '2026-01-01', DATE '2026-12-31', 'active')
  RETURNING id INTO v_c1;

  INSERT INTO public.supplier_contract_lines
    (contract_id, service_id, commission_type, commission_value)
  VALUES (v_c1, v_svc, 'percent', 5);

  -- Hợp đồng thứ hai, cùng đối tác, cùng dịch vụ, khoảng ngày giao nhau.
  INSERT INTO public.supplier_contracts
    (supplier_id, contract_no, signed_date, effective_from, effective_to, status)
  VALUES (v_sup, 'KC-2', DATE '2026-06-01', DATE '2026-06-01', DATE '2027-05-31', 'active')
  RETURNING id INTO v_c2;

  BEGIN
    INSERT INTO public.supplier_contract_lines
      (contract_id, service_id, commission_type, commission_value)
    VALUES (v_c2, v_svc, 'percent', 4);
  EXCEPTION WHEN check_violation THEN
    v_ok := true;
  END;

  -- Dọn sạch dù kết quả thế nào (CASCADE cuốn theo dòng).
  DELETE FROM public.supplier_contracts WHERE supplier_id = v_sup;
  DELETE FROM public.suppliers WHERE id = v_sup;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Trigger chống trùng hợp đồng KHÔNG hoạt động';
  END IF;
  RAISE NOTICE 'OK: trigger chống trùng hợp đồng đã chặn đúng';
END $$;
