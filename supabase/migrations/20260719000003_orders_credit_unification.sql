-- orders trở thành SỔ CÁI DOANH THU HỢP NHẤT của cả 3 loại dịch vụ.
--
-- Trước: trigger orders_require_direct chặn cứng mọi đơn không phải 'direct';
-- doanh thu credit suy ra từ ledger credit_transactions lúc chạy báo cáo, còn
-- doanh thu direct lấy từ orders → hai đường cộng song song.
--
-- Sau: MỖI GIAO DỊCH NẠP CREDIT SINH ĐÚNG MỘT DÒNG orders (trigger), nên báo
-- cáo chỉ đọc orders. Chống cộng trùng bằng CẤU TRÚC chứ không bằng kỷ luật code:
--   · orders.credit_transaction_id UNIQUE  ⇒ một lần nạp không thể sinh hai đơn
--   · CHECK service_kind='credit' ⇒ credit_transaction_id NOT NULL
--                                          ⇒ không tạo tay được đơn credit khống
--
-- Ý nghĩa cột tiền (áp cho MỌI kind):
--   amount       = tiền THỰC VỀ SÀN → đây là con số báo cáo cộng
--   gross_amount = giá trị hợp đồng (GMV) → chỉ số phụ, KHÔNG cộng vào doanh thu
-- Với direct/credit thì amount = gross_amount. Với commission thì
-- amount = hoa hồng sàn ăn, gross_amount = giá trị hợp đồng khách trả NCC.
--
-- Lợi ích kèm theo: resolvePurchase() đang join GIÁ LIVE của service_variants,
-- nghĩa là sửa giá một gói hôm nay đang âm thầm viết lại doanh thu credit lịch
-- sử. Chốt cứng vào orders.amount khử luôn lỗi đó.
--
-- THỨ TỰ QUAN TRỌNG: cột → backfill dữ liệu → MỚI thêm CHECK. Thêm CHECK trước
-- khi backfill sẽ vỡ ngay ở orders_amount_le_gross_check vì gross_amount còn 0.

-- ─── Nới trần tiền: NUMERIC(12,0) ≈ 999 tỷ là quá thấp cho hợp đồng môi giới ──

ALTER TABLE public.orders           ALTER COLUMN amount TYPE NUMERIC(18,0);
ALTER TABLE public.services         ALTER COLUMN price  TYPE NUMERIC(18,0);
ALTER TABLE public.service_variants ALTER COLUMN price  TYPE NUMERIC(18,0);

-- ─── credit_transactions: chốt cứng VND thực trả ─────────────────────────────

ALTER TABLE public.credit_transactions
  ADD COLUMN IF NOT EXISTS amount_vnd NUMERIC(18,0);

-- Backfill theo đúng thứ tự ưu tiên của resolvePurchase(): biến thể trước, rồi
-- khớp tên gói legacy trong description (CREDIT_PACKAGES cũ, trước khi catalog
-- chuyển sang gói theo đối tượng ở 20260715000001).
UPDATE public.credit_transactions ct
   SET amount_vnd = v.price
  FROM public.service_variants v
 WHERE v.id = ct.service_variant_id
   AND ct.type = 'purchase' AND ct.credit_delta > 0
   AND ct.amount_vnd IS NULL;

UPDATE public.credit_transactions ct
   SET amount_vnd = CASE
         WHEN ct.description LIKE '%Mua gói Starter%' THEN 69000
         WHEN ct.description LIKE '%Mua gói Popular%' THEN 179000
         WHEN ct.description LIKE '%Mua gói Value%'   THEN 299000
         WHEN ct.description LIKE '%Mua gói Pro%'     THEN 499000
         WHEN ct.description LIKE '%Mua gói Max%'     THEN 1999000
         ELSE 0 END
 WHERE ct.type = 'purchase' AND ct.credit_delta > 0
   AND ct.amount_vnd IS NULL;

-- ─── orders: cột mới (chưa ràng buộc) ────────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS service_kind          TEXT          NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS gross_amount          NUMERIC(18,0) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplier_id           UUID          REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS commission_type       TEXT,
  ADD COLUMN IF NOT EXISTS commission_value      NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS credit_transaction_id UUID          REFERENCES public.credit_transactions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS user_id               UUID          REFERENCES auth.users(id) ON DELETE SET NULL;

-- Đơn B2B có customer, đơn nạp credit có user → customer_id không còn bắt buộc.
ALTER TABLE public.orders ALTER COLUMN customer_id DROP NOT NULL;

-- ─── Backfill đơn hiện có TRƯỚC khi ràng buộc ────────────────────────────────
-- set_updated_at() gán now() vô điều kiện và tên sắp SAU orders_sync_* theo thứ
-- tự alphabet, nên chạy backfill khi trigger còn bật sẽ xoá sạch dấu vết audit.
ALTER TABLE public.orders DISABLE TRIGGER orders_updated_at;

-- Mọi đơn tồn tại đều là 'direct' (trigger cũ luôn chặn phần còn lại).
UPDATE public.orders SET service_kind = 'direct', gross_amount = amount;

ALTER TABLE public.orders ENABLE TRIGGER orders_updated_at;

-- ─── Ràng buộc khai báo ──────────────────────────────────────────────────────
-- KHÔNG chỉ dựa vào trigger, để cả đường ghi thẳng SQL cũng không tạo được đơn méo.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_service_kind_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_service_kind_check
    CHECK (service_kind IN ('credit', 'direct', 'commission'));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_party_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_party_check
    CHECK (num_nonnulls(customer_id, user_id) >= 1);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_commission_required_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_commission_required_check
    CHECK (service_kind <> 'commission'
           OR (supplier_id IS NOT NULL AND gross_amount > 0
               AND commission_type IS NOT NULL AND commission_value IS NOT NULL));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_commission_shape_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_commission_shape_check
    CHECK (service_kind = 'commission'
           OR (supplier_id IS NULL AND commission_type IS NULL AND commission_value IS NULL));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_commission_pct_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_commission_pct_check
    CHECK (commission_type IS DISTINCT FROM 'percent'
           OR (commission_value > 0 AND commission_value <= 100));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_credit_requires_tx_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_credit_requires_tx_check
    CHECK (service_kind <> 'credit' OR credit_transaction_id IS NOT NULL);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_amount_le_gross_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_amount_le_gross_check
    CHECK (amount <= gross_amount);

-- Một lần nạp ⇒ tối đa một đơn. Đây là chốt chống cộng trùng.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_credit_tx
  ON public.orders (credit_transaction_id) WHERE credit_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_supplier
  ON public.orders (supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_user
  ON public.orders (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_service_kind
  ON public.orders (service_kind, ordered_at DESC);

-- ─── Thay chốt cứng bằng trigger đồng bộ loại + tính hoa hồng ────────────────

DROP TRIGGER IF EXISTS orders_require_direct ON public.orders;
DROP FUNCTION IF EXISTS public.orders_require_direct_service();

CREATE OR REPLACE FUNCTION public.orders_sync_kind_and_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_kind     TEXT;
  v_supplier UUID;
BEGIN
  -- Chỉ đọc services khi thật sự cần → hàm idempotent, nên gắn BEFORE INSERT OR
  -- UPDATE không kèm OF-list vẫn an toàn: mọi UPDATE phụ (FK SET NULL, trigger
  -- fulfillment, sửa ghi chú) tính lại ra đúng cùng con số.
  IF TG_OP = 'INSERT' OR NEW.service_id IS DISTINCT FROM OLD.service_id THEN
    SELECT s.kind, s.supplier_id INTO v_kind, v_supplier
      FROM public.services s WHERE s.id = NEW.service_id FOR SHARE;
    IF v_kind IS NULL THEN
      RAISE EXCEPTION 'Dịch vụ không tồn tại' USING ERRCODE = 'foreign_key_violation';
    END IF;
    NEW.service_kind := v_kind;
    IF v_kind = 'commission' THEN
      NEW.supplier_id := COALESCE(NEW.supplier_id, v_supplier);
    END IF;
  END IF;

  IF NEW.service_kind = 'commission' THEN
    IF NEW.supplier_id IS NULL THEN
      RAISE EXCEPTION 'Đơn hoa hồng phải có nhà cung cấp' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.gross_amount IS NULL OR NEW.gross_amount <= 0 THEN
      RAISE EXCEPTION 'Đơn hoa hồng phải có giá trị hợp đồng' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.commission_type IS NULL OR NEW.commission_value IS NULL THEN
      RAISE EXCEPTION 'Đơn hoa hồng phải có loại và tỷ lệ hoa hồng' USING ERRCODE = 'check_violation';
    END IF;

    NEW.amount := CASE
      WHEN NEW.commission_type = 'percent'
        THEN round(NEW.gross_amount * NEW.commission_value / 100)
      ELSE round(NEW.commission_value * NEW.quantity)
    END;

    IF NEW.amount > NEW.gross_amount THEN
      RAISE EXCEPTION 'Hoa hồng vượt quá giá trị hợp đồng' USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    -- Gán VÔ ĐIỀU KIỆN (không `IF gross_amount = 0`): sửa giá một đơn direct mà
    -- không đồng bộ sẽ để GMV lệch vĩnh viễn.
    NEW.gross_amount     := NEW.amount;
    NEW.supplier_id      := NULL;
    NEW.commission_type  := NULL;
    NEW.commission_value := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_sync_kind_and_commission
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_sync_kind_and_commission();

-- ─── Mỗi lần nạp credit ⇒ một đơn hàng ───────────────────────────────────────

-- Dịch vụ mặc định cho các dòng nạp không gắn biến thể (gói legacy đã gỡ khỏi
-- catalog, hoặc nạp tự do). Chọn nhóm gói Người mua — gói legacy vốn là gói mua.
CREATE OR REPLACE FUNCTION public.credit_fallback_service_id()
RETURNS UUID AS $$
  SELECT id FROM public.services
   WHERE kind = 'credit' AND category = 'package'
   ORDER BY (audience = 'buyer') DESC, sort_order
   LIMIT 1;
$$ LANGUAGE sql STABLE;

-- SECURITY DEFINER bắt buộc: trigger chạy trong transaction của người mua, còn
-- orders là RLS admin-only ⇒ hàm thường sẽ làm luồng nạp credit bắt đầu lỗi.
CREATE OR REPLACE FUNCTION public.credit_transactions_create_order()
RETURNS TRIGGER AS $$
DECLARE
  v_service_id UUID;
  v_amount     NUMERIC(18,0);
BEGIN
  SELECT v.service_id, COALESCE(NEW.amount_vnd, v.price, 0)
    INTO v_service_id, v_amount
    FROM public.service_variants v WHERE v.id = NEW.service_variant_id;

  IF v_service_id IS NULL THEN
    v_service_id := public.credit_fallback_service_id();
    v_amount     := COALESCE(NEW.amount_vnd, 0);
  END IF;

  -- Không có dịch vụ credit nào trong catalog ⇒ bỏ qua, tuyệt đối không chặn
  -- giao dịch nạp của khách vì lý do cấu hình back-office.
  IF v_service_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.orders (
    service_id, service_variant_id, user_id, credit_transaction_id,
    quantity, amount, gross_amount,
    fulfillment_status, ordered_at, fulfilled_at, note
  ) VALUES (
    v_service_id, NEW.service_variant_id, NEW.user_id, NEW.id,
    1, v_amount, v_amount,
    'fulfilled', NEW.created_at, NEW.created_at, NEW.description
  )
  ON CONFLICT (credit_transaction_id) WHERE credit_transaction_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER credit_transactions_create_order
  AFTER INSERT ON public.credit_transactions
  FOR EACH ROW
  WHEN (NEW.type = 'purchase' AND NEW.credit_delta > 0)
  EXECUTE FUNCTION public.credit_transactions_create_order();

-- ─── Backfill lịch sử nạp credit thành đơn hàng ──────────────────────────────
-- Điều kiện Gate A: tổng amount của các đơn 'credit' sinh ra ở đây phải khớp
-- TỪNG CHỮ SỐ với creditVnd mà báo cáo đang hiển thị trước migration.
-- service_kind do trigger orders_sync_kind_and_commission tự gán từ services.kind.

ALTER TABLE public.orders DISABLE TRIGGER orders_updated_at;

INSERT INTO public.orders (
  service_id, service_variant_id, user_id, credit_transaction_id,
  quantity, amount, gross_amount,
  fulfillment_status, ordered_at, fulfilled_at, note
)
SELECT
  COALESCE(v.service_id, public.credit_fallback_service_id()),
  ct.service_variant_id,
  ct.user_id,
  ct.id,
  1,
  COALESCE(ct.amount_vnd, 0),
  COALESCE(ct.amount_vnd, 0),
  'fulfilled',
  ct.created_at,
  ct.created_at,
  ct.description
FROM public.credit_transactions ct
LEFT JOIN public.service_variants v ON v.id = ct.service_variant_id
WHERE ct.type = 'purchase' AND ct.credit_delta > 0
  AND COALESCE(v.service_id, public.credit_fallback_service_id()) IS NOT NULL
ON CONFLICT (credit_transaction_id) WHERE credit_transaction_id IS NOT NULL DO NOTHING;

ALTER TABLE public.orders ENABLE TRIGGER orders_updated_at;

-- ─── Kiểm chứng ngay trong migration ─────────────────────────────────────────
DO $$
DECLARE
  v_missing  INTEGER;
  v_mismatch INTEGER;
  v_wrongkind INTEGER;
BEGIN
  SELECT count(*) INTO v_missing
    FROM public.credit_transactions ct
   WHERE ct.type = 'purchase' AND ct.credit_delta > 0
     AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.credit_transaction_id = ct.id);
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Backfill thiếu: % dòng nạp không sinh đơn', v_missing;
  END IF;

  SELECT count(*) INTO v_mismatch
    FROM public.orders o
    JOIN public.credit_transactions ct ON ct.id = o.credit_transaction_id
   WHERE o.amount IS DISTINCT FROM COALESCE(ct.amount_vnd, 0);
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'Backfill lệch tiền ở % đơn', v_mismatch;
  END IF;

  SELECT count(*) INTO v_wrongkind
    FROM public.orders o JOIN public.services s ON s.id = o.service_id
   WHERE o.service_kind IS DISTINCT FROM s.kind;
  IF v_wrongkind > 0 THEN
    RAISE EXCEPTION 'Sai snapshot service_kind ở % đơn', v_wrongkind;
  END IF;
END $$;
