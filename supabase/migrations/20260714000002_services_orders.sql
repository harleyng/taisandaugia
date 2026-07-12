-- Dịch vụ (Services catalog) + Đơn hàng (Orders) — back-office admin-only.
--
-- services = danh mục hợp nhất mọi thứ nền tảng bán, gắn nhãn kind:
--   'credit' = tính năng/gói tính bằng credit (seed để tham chiếu & phân nguồn
--              doanh thu; KHÔNG đặt đơn hàng trực tiếp — tiền vào qua ledger credit).
--   'direct' = dịch vụ bán trực tiếp bằng VND (quảng cáo…) — orders đặt vào đây.
-- orders   = đơn hàng của customers (B2B) cho dịch vụ 'direct'. Tự "đã trả quyền lợi"
--            (fulfilled) khi banner liên kết chuyển sang 'active' (trigger) + chỉnh tay.
-- RLS admin-only theo chuẩn advertising/customers (has_role(...,'ADMIN')).

-- ─── services (Danh mục dịch vụ) ─────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.service_code_seq START 1;

CREATE TABLE public.services (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT          UNIQUE,                        -- 'DV000001'
  name               TEXT          NOT NULL,
  kind               TEXT          NOT NULL DEFAULT 'direct' CHECK (kind IN ('credit', 'direct')),
  category           TEXT,                                        -- 'package'|'unlock'|'advertising'|…
  credit_feature_key TEXT,                                        -- gói: CREDIT_PACKAGES.key · unlock: credit_transactions.type · NULL cho direct
  price              NUMERIC(12,0) NOT NULL DEFAULT 0,            -- VND (gói credit & dịch vụ direct); 0 cho tính năng credit
  credit_cost        INTEGER,                                     -- chi phí/định lượng theo credit (tham chiếu), NULL cho direct
  description        TEXT,
  is_active          BOOLEAN       NOT NULL DEFAULT true,
  sort_order         INTEGER       NOT NULL DEFAULT 0,
  created_by         UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_kind   ON public.services (kind, sort_order);
CREATE INDEX idx_services_active ON public.services (is_active);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_admin_all"
  ON public.services FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE OR REPLACE FUNCTION public.set_service_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'DV' || lpad(nextval('public.service_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER services_set_code
  BEFORE INSERT ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_service_code();

CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── orders (Đơn hàng) ───────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.order_code_seq START 1;

CREATE TABLE public.orders (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT          UNIQUE,                        -- 'DH000001'
  customer_id        UUID          NOT NULL REFERENCES public.customers(id)      ON DELETE RESTRICT,
  service_id         UUID          NOT NULL REFERENCES public.services(id)       ON DELETE RESTRICT,
  quantity           INTEGER       NOT NULL DEFAULT 1 CHECK (quantity > 0),
  amount             NUMERIC(12,0) NOT NULL DEFAULT 0,            -- tổng tiền VND
  fulfillment_status TEXT          NOT NULL DEFAULT 'pending'
                       CHECK (fulfillment_status IN ('pending', 'fulfilled', 'cancelled')),
  advertisement_id   UUID          REFERENCES public.advertisements(id) ON DELETE SET NULL,
  note               TEXT,
  ordered_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),        -- ngày ghi nhận doanh thu (cho nhập lùi)
  fulfilled_at       TIMESTAMPTZ,
  created_by         UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_customer      ON public.orders (customer_id);
CREATE INDEX idx_orders_service       ON public.orders (service_id);
CREATE INDEX idx_orders_status        ON public.orders (fulfillment_status, created_at DESC);
CREATE INDEX idx_orders_ordered_at    ON public.orders (ordered_at DESC);
CREATE INDEX idx_orders_advertisement ON public.orders (advertisement_id) WHERE advertisement_id IS NOT NULL;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_admin_all"
  ON public.orders FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE OR REPLACE FUNCTION public.set_order_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'DH' || lpad(nextval('public.order_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_set_code
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_order_code();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Chốt cứng: đơn hàng chỉ đặt vào dịch vụ 'direct' (tránh double-count với ledger credit).
CREATE OR REPLACE FUNCTION public.orders_require_direct_service()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT kind FROM public.services WHERE id = NEW.service_id) IS DISTINCT FROM 'direct' THEN
    RAISE EXCEPTION 'Chỉ được đặt đơn cho dịch vụ bán trực tiếp (kind=direct)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_require_direct
  BEFORE INSERT OR UPDATE OF service_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_require_direct_service();

-- Fulfillment A: banner liên kết chuyển sang 'active' ⇒ đơn 'pending' tự "đã trả quyền lợi".
CREATE OR REPLACE FUNCTION public.orders_fulfill_on_ad_active()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    UPDATE public.orders
      SET fulfillment_status = 'fulfilled',
          fulfilled_at       = now(),
          updated_at         = now()
    WHERE advertisement_id = NEW.id
      AND fulfillment_status = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER advertisements_fulfill_orders
  AFTER UPDATE OF status ON public.advertisements
  FOR EACH ROW EXECUTE FUNCTION public.orders_fulfill_on_ad_active();

-- Fulfillment B: đơn tạo/gắn vào banner ĐÃ 'active' ⇒ trả quyền lợi ngay.
CREATE OR REPLACE FUNCTION public.orders_fulfill_on_link()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.advertisement_id IS NOT NULL
     AND NEW.fulfillment_status = 'pending'
     AND EXISTS (SELECT 1 FROM public.advertisements a
                 WHERE a.id = NEW.advertisement_id AND a.status = 'active') THEN
    NEW.fulfillment_status := 'fulfilled';
    NEW.fulfilled_at       := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_fulfill_on_link
  BEFORE INSERT OR UPDATE OF advertisement_id, fulfillment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_fulfill_on_link();

-- ─── Seed danh mục dịch vụ (one-shot) ────────────────────────────────────────
-- Gói credit: price = giá VND thực, credit_cost = credit nhận về.
-- Tính năng credit: price = 0, credit_cost = chi phí credit của tính năng.
-- Dịch vụ direct: đặt đơn hàng vào đây.

INSERT INTO public.services (name, kind, category, credit_feature_key, price, credit_cost, sort_order) VALUES
  ('Gói Starter',                          'credit', 'package', 'starter',           69000,   69, 10),
  ('Gói Popular',                          'credit', 'package', 'popular',          179000,  190, 11),
  ('Gói Value',                            'credit', 'package', 'value',            299000,  330, 12),
  ('Gói Pro',                              'credit', 'package', 'pro',              499000,  600, 13),
  ('Gói Max',                              'credit', 'package', 'max',             1999000, 2600, 14),
  ('Mở khóa tài sản',                      'credit', 'unlock',  'unlock_asset',          0,   59, 20),
  ('Theo dõi công ty 7 ngày',              'credit', 'unlock',  'unlock_company',        0,   99, 21),
  ('Theo dõi công ty 30 ngày',             'credit', 'unlock',  'unlock_company',        0,  299, 22),
  ('Theo dõi công ty 1 năm',               'credit', 'unlock',  'unlock_company',        0, 1990, 23),
  ('Theo dõi chủ tài sản 7 ngày',          'credit', 'unlock',  'unlock_owner',          0,   49, 24),
  ('Theo dõi chủ tài sản 30 ngày',         'credit', 'unlock',  'unlock_owner',          0,  149, 25),
  ('Theo dõi chủ tài sản 1 năm',           'credit', 'unlock',  'unlock_owner',          0,  995, 26),
  ('Mở khóa báo cáo chuyên sâu (tháng)',   'credit', 'unlock',  'unlock_deep_report',    0,  990, 27),
  ('Mở khóa báo cáo chuyên sâu (quý)',     'credit', 'unlock',  'unlock_deep_report',    0, 2490, 28),
  ('Mở khóa báo cáo chuyên sâu (năm)',     'credit', 'unlock',  'unlock_deep_report',    0, 8900, 29),
  ('Xem báo cáo chủ tài sản (bộ lọc)',     'credit', 'unlock',  'owner_report_view',     0,   49, 30),
  ('Quảng cáo',                            'direct', 'advertising', NULL,                0, NULL,  1);
