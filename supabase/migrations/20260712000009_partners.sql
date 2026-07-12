-- Đối tác (Partner) — section homepage "Đồng hành cùng những thương hiệu…".
-- Admin CRUD (active/inactive + thứ tự); homepage đọc công khai các đối tác active.
-- set_updated_at() đã tồn tại (20260621000001_asset_postings.sql) — chỉ tham chiếu.

CREATE TABLE public.partners (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  badge        TEXT        NOT NULL DEFAULT '',
  accent_color TEXT        NOT NULL DEFAULT '#367639',
  logo_url     TEXT,
  logo_filter  TEXT,                     -- CSS filter tùy chọn (seed-only, không hiện trong form)
  tagline      TEXT,
  description  TEXT,
  stats        JSONB       NOT NULL DEFAULT '[]'::jsonb,  -- [{label, value}]
  date_label   TEXT,
  date_value   TEXT,                     -- text thường, vd "31 · 05 · 2026"
  cta_text     TEXT,
  cta_href     TEXT,
  sort_order   INTEGER     NOT NULL DEFAULT 0,            -- thứ tự hiển thị
  status       TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partners_status_sort ON public.partners (status, sort_order);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Anon/homepage: chỉ đối tác đang active
CREATE POLICY "partners_public_read"
  ON public.partners FOR SELECT
  USING (status = 'active');

-- Admin toàn quyền
CREATE POLICY "partners_admin_all"
  ON public.partners FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));
