-- Quảng cáo (Advertising / Banner) — back-office admin-only.
-- Master data 2 cấp: ad_pages (Trang hiển thị) → ad_positions (Vị trí hiển thị).
-- Mỗi vị trí có loại 'slide' (không giới hạn banner) / 'unique' (chỉ 1 banner chạy
-- tại 1 thời điểm — chốt cứng bằng trigger enforce_unique_ad_position).
-- advertisements = banner; ad_daily_stats = số liệu theo ngày (demo, chưa tracking thật).
-- customers = khách hàng dùng chung cho nhiều dịch vụ (không riêng quảng cáo).
-- RLS admin-only theo chuẩn marketing_campaigns (has_role(...,'ADMIN')).

-- ─── ad_pages (Trang hiển thị — master data) ─────────────────────────────────

CREATE TABLE public.ad_pages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ad_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_pages_admin_all"
  ON public.ad_pages FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE TRIGGER ad_pages_updated_at
  BEFORE UPDATE ON public.ad_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── customers (Khách hàng — dùng chung nhiều dịch vụ) ───────────────────────

CREATE SEQUENCE IF NOT EXISTS public.customer_code_seq START 1;

CREATE TABLE public.customers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT        UNIQUE,
  name          TEXT        NOT NULL,
  customer_type TEXT        NOT NULL DEFAULT 'company' CHECK (customer_type IN ('individual', 'company')),
  contact_name  TEXT,
  phone         TEXT,
  email         TEXT,
  tax_code      TEXT,
  address       TEXT,
  note          TEXT,
  status        TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_status ON public.customers (status, created_at DESC);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_admin_all"
  ON public.customers FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE OR REPLACE FUNCTION public.set_customer_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'KH' || lpad(nextval('public.customer_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_set_code
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_customer_code();

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── ad_positions (Vị trí hiển thị — master data: loại + giá) ────────────────

CREATE TABLE public.ad_positions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id        UUID        NOT NULL REFERENCES public.ad_pages(id) ON DELETE RESTRICT,
  name           TEXT        NOT NULL,
  code           TEXT,
  placement_type TEXT        NOT NULL DEFAULT 'slide' CHECK (placement_type IN ('slide', 'unique')),
  price          NUMERIC(12,0) NOT NULL DEFAULT 0,          -- giá tiền (VND)
  desktop_width  INTEGER     NOT NULL DEFAULT 795,
  desktop_height INTEGER     NOT NULL DEFAULT 255,
  mobile_width   INTEGER     NOT NULL DEFAULT 375,
  mobile_height  INTEGER     NOT NULL DEFAULT 200,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_positions_page ON public.ad_positions (page_id);

ALTER TABLE public.ad_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_positions_admin_all"
  ON public.ad_positions FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

CREATE TRIGGER ad_positions_updated_at
  BEFORE UPDATE ON public.ad_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── advertisements (Banner) ─────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.ad_code_seq START 1;

CREATE TABLE public.advertisements (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT        UNIQUE,                       -- 'B0000009'
  name              TEXT        NOT NULL,
  is_test           BOOLEAN     NOT NULL DEFAULT false,       -- Banner thật / Banner test
  position_id       UUID        NOT NULL REFERENCES public.ad_positions(id) ON DELETE RESTRICT,
  show_desktop      BOOLEAN     NOT NULL DEFAULT true,
  show_mobile       BOOLEAN     NOT NULL DEFAULT true,
  desktop_image_url TEXT,
  mobile_image_url  TEXT,
  nav_type          TEXT        NOT NULL DEFAULT 'none' CHECK (nav_type IN ('none', 'link', 'listing')),
  nav_url           TEXT,
  nav_filter        JSONB,
  start_type        TEXT        NOT NULL DEFAULT 'immediate' CHECK (start_type IN ('immediate', 'scheduled')),
  start_at          TIMESTAMPTZ,
  end_type          TEXT        NOT NULL DEFAULT 'continuous' CHECK (end_type IN ('continuous', 'scheduled')),
  end_at            TIMESTAMPTZ,
  sort_order        INTEGER     NOT NULL DEFAULT 1,           -- Thứ tự hiển thị
  status            TEXT        NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'ended')),
  view_count        INTEGER     NOT NULL DEFAULT 0,
  click_count       INTEGER     NOT NULL DEFAULT 0,
  customer_id       UUID        REFERENCES public.customers(id) ON DELETE SET NULL,
  created_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_advertisements_status_created ON public.advertisements (status, created_at DESC);
CREATE INDEX idx_advertisements_position       ON public.advertisements (position_id);
CREATE INDEX idx_advertisements_customer       ON public.advertisements (customer_id);

ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advertisements_admin_all"
  ON public.advertisements FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

-- Sinh mã B0000009
CREATE OR REPLACE FUNCTION public.set_advertisement_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'B' || lpad(nextval('public.ad_code_seq')::text, 7, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER advertisements_set_code
  BEFORE INSERT ON public.advertisements
  FOR EACH ROW EXECUTE FUNCTION public.set_advertisement_code();

CREATE TRIGGER advertisements_updated_at
  BEFORE UPDATE ON public.advertisements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Chốt cứng: vị trí 'unique' chỉ cho 1 banner (scheduled/active) trong khoảng
-- thời gian trùng lặp. Vị trí 'slide' không bị chặn.
CREATE OR REPLACE FUNCTION public.enforce_unique_ad_position()
RETURNS TRIGGER AS $$
DECLARE
  v_type     TEXT;
  v_conflict INTEGER;
BEGIN
  IF NEW.status NOT IN ('scheduled', 'active') THEN
    RETURN NEW;
  END IF;

  SELECT placement_type INTO v_type
  FROM public.ad_positions
  WHERE id = NEW.position_id;

  IF v_type IS DISTINCT FROM 'unique' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_conflict
  FROM public.advertisements a
  WHERE a.position_id = NEW.position_id
    AND a.id <> NEW.id
    AND a.status IN ('scheduled', 'active')
    AND tstzrange(COALESCE(a.start_at, now()), COALESCE(a.end_at, 'infinity'::timestamptz))
        && tstzrange(COALESCE(NEW.start_at, now()), COALESCE(NEW.end_at, 'infinity'::timestamptz));

  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'Vị trí duy nhất (unique) đã có banner khác chạy trong khoảng thời gian trùng lặp'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER advertisements_enforce_unique_position
  BEFORE INSERT OR UPDATE ON public.advertisements
  FOR EACH ROW EXECUTE FUNCTION public.enforce_unique_ad_position();

-- ─── ad_daily_stats (số liệu theo ngày — demo) ───────────────────────────────

CREATE TABLE public.ad_daily_stats (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  advertisement_id UUID        NOT NULL REFERENCES public.advertisements(id) ON DELETE CASCADE,
  stat_date        DATE        NOT NULL,
  device           TEXT        NOT NULL CHECK (device IN ('desktop', 'mobile')),
  views            INTEGER     NOT NULL DEFAULT 0,
  clicks           INTEGER     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (advertisement_id, stat_date, device)
);

CREATE INDEX idx_ad_daily_stats_ad_date ON public.ad_daily_stats (advertisement_id, stat_date);

ALTER TABLE public.ad_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ad_daily_stats_admin_all"
  ON public.ad_daily_stats FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));
