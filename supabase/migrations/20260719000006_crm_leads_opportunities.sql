-- CRM: Khách hàng tiềm năng (leads) + Cơ hội (opportunities).
--
-- Phễu: leads --(cơ hội)--> chốt thắng --> customers + orders.
-- Một cơ hội = bán MỘT dịch vụ cho MỘT bên. Bên đó là lead (chưa chuyển đổi)
-- HOẶC customer (đã là khách) — đúng một trong hai, không có trạng thái nhập
-- nhằng "vừa lead vừa khách": CHECK num_nonnulls(lead_id, customer_id) = 1.
-- Khi chốt thắng, RPC chuyển lead → customer rồi dời cơ hội sang customer_id.
--
-- 5 giai đoạn khớp bảng kanban: Bán hàng · Chờ xét duyệt · Bị từ chối ·
-- Thành công · Thất bại.
--
-- revenue_mode phân biệt "cố ý không sinh đơn" với "đơn bị xóa":
--   order         = đã sinh đơn hàng (dịch vụ direct / hoa hồng)
--   credit_ledger = bán gói credit — KHÔNG sinh đơn ở đây; đơn chỉ ra đời khi
--                   khách NẠP THẬT (trigger credit_transactions_create_order),
--                   nên khoảng lệch dự kiến ↔ thực nạp là HỮU HÌNH
--   none          = chưa/không ghi nhận doanh thu

-- ─── leads (Khách hàng tiềm năng) ────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.lead_code_seq START 1;

CREATE TABLE public.leads (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT        UNIQUE,                        -- 'TN000001'
  name                  TEXT        NOT NULL,
  contact_name          TEXT,
  phone                 TEXT,
  email                 TEXT,
  company_name          TEXT,
  lead_type             TEXT        NOT NULL DEFAULT 'other'
                          CHECK (lead_type IN ('auction_company','asset_owner','bank','investor','broker','other')),
  source                TEXT        NOT NULL DEFAULT 'other'
                          CHECK (source IN ('contact_form','partnership_form','hotline','email','referral','event','ads','other')),
  status                TEXT        NOT NULL DEFAULT 'new'
                          CHECK (status IN ('new','contacted','qualified','nurturing','converted','disqualified')),
  province              TEXT,
  note                  TEXT,
  assigned_to           UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  converted_customer_id UUID        REFERENCES public.customers(id) ON DELETE SET NULL,
  converted_at          TIMESTAMPTZ,
  created_by            UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Hai chiều: đã chuyển đổi ⇔ có khách hàng. Không cho lệch.
  CONSTRAINT leads_converted_check
    CHECK ((status = 'converted') = (converted_customer_id IS NOT NULL))
);

CREATE INDEX idx_leads_status   ON public.leads (status, created_at DESC);
CREATE INDEX idx_leads_assigned ON public.leads (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_leads_phone    ON public.leads (phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_leads_email    ON public.leads (email) WHERE email IS NOT NULL;
-- Lead ↔ Khách hàng là 1:1 (ảnh 2: "Convert Lead thành công").
CREATE UNIQUE INDEX idx_leads_converted_customer
  ON public.leads (converted_customer_id) WHERE converted_customer_id IS NOT NULL;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_admin_all"
  ON public.leads FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE OR REPLACE FUNCTION public.set_lead_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'TN' || lpad(nextval('public.lead_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_set_code
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_lead_code();

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── customers: bổ sung phân khúc + liên kết tài khoản + nguồn gốc ───────────

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS segment        TEXT NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

-- Cùng từ vựng với leads.lead_type để chuyển đổi copy 1:1, không phải map.
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_segment_check;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_segment_check
    CHECK (segment IN ('auction_company','asset_owner','bank','investor','broker','other'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user
  ON public.customers (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_source_lead
  ON public.customers (source_lead_id) WHERE source_lead_id IS NOT NULL;

-- LƯU Ý: customers_admin_all vẫn là policy DUY NHẤT. Gắn user_id KHÔNG mở
-- quyền đọc cho user đó — bảng chứa MST và ghi chú bán hàng nội bộ.

-- ─── opportunities (Cơ hội) ──────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.opportunity_code_seq START 1;

CREATE TABLE public.opportunities (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT          UNIQUE,                        -- 'CH000001'
  name               TEXT          NOT NULL,
  -- ĐÚNG MỘT trong hai. RESTRICT để xóa khách/lead không cuốn mất phễu.
  lead_id            UUID          REFERENCES public.leads(id)     ON DELETE RESTRICT,
  customer_id        UUID          REFERENCES public.customers(id) ON DELETE RESTRICT,
  opportunity_type   TEXT          NOT NULL DEFAULT 'new_business'
                       CHECK (opportunity_type IN ('new_business','renewal','upsell','cross_sell','referral')),
  stage              TEXT          NOT NULL DEFAULT 'selling'
                       CHECK (stage IN ('selling','pending_approval','rejected','won','lost')),
  service_id         UUID          NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  service_variant_id UUID          REFERENCES public.service_variants(id) ON DELETE SET NULL,
  service_kind       TEXT          NOT NULL DEFAULT 'direct'
                       CHECK (service_kind IN ('credit','direct','commission')),
  amount             NUMERIC(18,0) NOT NULL DEFAULT 0,   -- doanh thu sàn dự kiến (net)
  gross_amount       NUMERIC(18,0) NOT NULL DEFAULT 0,   -- giá trị hợp đồng dự kiến
  commission_type    TEXT          CHECK (commission_type IS NULL OR commission_type IN ('percent','fixed')),
  commission_value   NUMERIC(12,2),
  expected_close_at  TIMESTAMPTZ,                        -- "Hết hạn" trên thẻ kanban
  closed_at          TIMESTAMPTZ,                        -- trigger dẫn xuất, client không ghi
  lost_reason        TEXT,
  won_order_id       UUID          REFERENCES public.orders(id) ON DELETE RESTRICT,
  revenue_mode       TEXT          NOT NULL DEFAULT 'none'
                       CHECK (revenue_mode IN ('order','credit_ledger','none')),
  assigned_to        UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  sort_order         INTEGER       NOT NULL DEFAULT 0,   -- thứ tự trong cột kanban
  note               TEXT,
  created_by         UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT opportunities_owner_xor
    CHECK (num_nonnulls(lead_id, customer_id) = 1),
  -- Thua/từ chối phải nêu lý do — nếu không, phân tích phễu vô nghĩa.
  CONSTRAINT opportunities_lost_reason_check
    CHECK (stage NOT IN ('lost','rejected') OR lost_reason IS NOT NULL)
);

CREATE INDEX idx_opportunities_stage    ON public.opportunities (stage, created_at DESC);
CREATE INDEX idx_opportunities_lead     ON public.opportunities (lead_id)     WHERE lead_id IS NOT NULL;
CREATE INDEX idx_opportunities_customer ON public.opportunities (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_opportunities_service  ON public.opportunities (service_id);
CREATE INDEX idx_opportunities_assigned ON public.opportunities (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_opportunities_due
  ON public.opportunities (expected_close_at) WHERE stage IN ('selling','pending_approval');
-- Một cơ hội ↔ một đơn.
CREATE UNIQUE INDEX idx_opportunities_won_order
  ON public.opportunities (won_order_id) WHERE won_order_id IS NOT NULL;

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opportunities_admin_all"
  ON public.opportunities FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE OR REPLACE FUNCTION public.set_opportunity_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'CH' || lpad(nextval('public.opportunity_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER opportunities_set_code
  BEFORE INSERT ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_opportunity_code();

CREATE TRIGGER opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- closed_at là dẫn xuất của stage, không để client tự ghi lệch.
CREATE OR REPLACE FUNCTION public.opportunities_sync_close()
RETURNS TRIGGER AS $$
DECLARE v_kind TEXT;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.service_id IS DISTINCT FROM OLD.service_id THEN
    SELECT kind INTO v_kind FROM public.services WHERE id = NEW.service_id;
    IF v_kind IS NULL THEN
      RAISE EXCEPTION 'Dịch vụ không tồn tại' USING ERRCODE = 'foreign_key_violation';
    END IF;
    NEW.service_kind := v_kind;
  END IF;

  NEW.closed_at := CASE
    WHEN NEW.stage IN ('won','lost','rejected') THEN COALESCE(NEW.closed_at, now())
    ELSE NULL
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER opportunities_sync_close
  BEFORE INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.opportunities_sync_close();

-- Chặn CẢ HAI CHIỀU vào/ra 'won' trừ khi đi qua RPC. Chốt thắng đụng 4 bảng
-- (lead → customer → order → cơ hội); cho UPDATE trần sẽ sinh đơn mồ côi hoặc
-- doanh thu ghi nhận hai lần.
CREATE OR REPLACE FUNCTION public.opportunities_guard_won()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.stage = 'won') IS DISTINCT FROM (OLD.stage = 'won')
     AND COALESCE(current_setting('app.admin_win', true), '') <> 'on' THEN
    RAISE EXCEPTION 'Chốt/bỏ chốt cơ hội phải qua chức năng Chốt thắng'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER opportunities_guard_won
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.opportunities_guard_won();

-- ─── orders: truy vết về cơ hội đã sinh ra đơn ───────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_opportunity
  ON public.orders (opportunity_id) WHERE opportunity_id IS NOT NULL;
