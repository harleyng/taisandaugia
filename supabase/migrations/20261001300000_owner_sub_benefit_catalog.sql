-- Danh mục quyền lợi CỐ ĐỊNH cho gói dịch vụ chủ tài sản (2026-10-01).
--
-- Trước đây gói có 2 danh sách tách rời: "tính năng tính hạn mức" (chỉ quét 3D + báo cáo danh
-- mục, luôn theo tháng) và "dòng quyền lợi" chữ tự do (nhóm · nhãn · giá trị) chỉ để hiển thị.
-- Người dùng chốt: MỘT danh mục quyền lợi cố định trong DB (không có màn sửa — đổi danh mục =
-- viết migration), admin thêm quyền lợi vào gói và đặt HẠN MỨC + CHU KỲ LÀM MỚI cho từng dòng.
--
--   • owner_sub_benefits           — danh mục cố định (seed bên dưới), client chỉ đọc.
--       kind   'quota' = hạn mức (số hoặc NULL = không giới hạn) + chu kỳ;
--              'level' = một mức số, càng NHỎ càng tốt (giờ phản hồi), không chu kỳ.
--       source 'enforced' = hệ thống KIỂM (_owner_sub_consume — key trùng service_variants);
--              'live'     = đếm thật để hiển thị, không chặn;
--              'display'  = chỉ hiển thị (lượt dùng lấy từ bảng giữ chỗ nếu có).
--   • owner_subscription_plan_entitlements / owner_subscription_entitlements — mỗi dòng giờ là
--       (benefit_key, quota, cycle, sort_order); variant_key → benefit_key, monthly_quota → quota.
--       THỨ TỰ dòng quyết định 8 dòng lên thẻ gói.
--   • owner_subscription_plans.benefits (JSONB chữ tự do) — chuyển thành dòng rồi XOÁ cột.
--   • owner_subscription_usage — period_month → used_on (ngày giờ VN); cửa sổ đếm tính lúc đọc
--       theo chu kỳ (owner_sub_window), nên đổi chu kỳ không mất dữ liệu.
--   • owner_subscription_benefit_usage (số giữ chỗ) — khớp theo benefit_key thay vì nhãn chữ.
--
-- Chu kỳ: day / week (thứ Hai) / month / quarter / year theo LỊCH giờ VN; 'term' = kỳ đã trả
-- đang hiệu lực (owner_subscription_terms), không làm mới trong kỳ.
-- Gỡ: owner_sub_supported_variants(), owner_sub_benefit_usage(), admin_owner_sub_upsert(),
-- admin_owner_sub_activate(p_sub_id …) (2 hàm cuối đã thu quyền từ 20261001120000).

-- ─── 1. Danh mục cố định ─────────────────────────────────────────────────────

CREATE TABLE public.owner_sub_benefits (
  key           TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_]{2,40}$'),
  group_name    TEXT NOT NULL,
  label         TEXT NOT NULL UNIQUE,
  unit          TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('quota', 'level')),
  level_format  TEXT CHECK (level_format IS NULL OR level_format LIKE '%{n}%'),
  source        TEXT NOT NULL CHECK (source IN ('enforced', 'live', 'display')),
  default_cycle TEXT CHECK (default_cycle IN ('day', 'week', 'month', 'quarter', 'year', 'term')),
  sort_order    INTEGER NOT NULL,
  CONSTRAINT owner_sub_benefits_kind_shape CHECK (
    (kind = 'quota' AND default_cycle IS NOT NULL AND level_format IS NULL)
    OR (kind = 'level' AND default_cycle IS NULL AND level_format IS NOT NULL AND source = 'display'))
);
ALTER TABLE public.owner_sub_benefits ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_sub_benefits_read ON public.owner_sub_benefits FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.owner_sub_benefits FROM anon, authenticated;

INSERT INTO public.owner_sub_benefits
  (key, group_name, label, unit, kind, level_format, source, default_cycle, sort_order) VALUES
  ('scan_3d_owner',          'Tài sản',  'Quét 3D tài sản',             'lượt quét', 'quota', NULL, 'enforced', 'month', 10),
  ('digitize_posting',       'Tài sản',  'Số hoá hồ sơ',                'hồ sơ',     'quota', NULL, 'live',     'month', 20),
  ('priority_listing',       'Tài sản',  'Tin đăng ưu tiên',            'tin',       'quota', NULL, 'display',  'month', 30),
  ('vr_tour',                'Tài sản',  'Tour VR 360°',                'tour',      'quota', NULL, 'display',  'month', 40),
  ('doc_storage',            'Tài sản',  'Lưu trữ tài liệu',            'GB',        'quota', NULL, 'display',  'term',  50),
  ('custom_template',        'Tài sản',  'Mẫu hồ sơ tuỳ chỉnh',         'mẫu',       'quota', NULL, 'display',  'term',  60),
  ('report_portfolio_owner', 'Báo cáo',  'Báo cáo danh mục tuỳ chỉnh',  'lượt xem',  'quota', NULL, 'enforced', 'month', 110),
  ('market_report',          'Báo cáo',  'Báo cáo thị trường',          'lượt xem',  'quota', NULL, 'display',  'month', 120),
  ('pdf_export',             'Báo cáo',  'Xuất báo cáo PDF',            'bản',       'quota', NULL, 'display',  'month', 130),
  ('excel_export',           'Báo cáo',  'Xuất dữ liệu Excel',          'lượt',      'quota', NULL, 'display',  'month', 140),
  ('branch_dashboard',       'Báo cáo',  'Dashboard theo chi nhánh',    'dashboard', 'quota', NULL, 'display',  'term',  150),
  ('scheduled_report',       'Báo cáo',  'Báo cáo định kỳ tự động',     'lịch gửi',  'quota', NULL, 'display',  'term',  160),
  ('investor_invite',        'Tiếp cận', 'Thư mời gửi nhà đầu tư',      'thư',       'quota', NULL, 'display',  'month', 210),
  ('session_sms',            'Tiếp cận', 'SMS thông báo phiên',         'tin',       'quota', NULL, 'display',  'month', 220),
  ('org_page',               'Tiếp cận', 'Trang giới thiệu tổ chức',    'trang',     'quota', NULL, 'display',  'term',  230),
  ('home_banner',            'Tiếp cận', 'Banner trang chủ',            'lượt',      'quota', NULL, 'display',  'month', 240),
  ('members',                'Tổ chức',  'Thành viên',                  'người',     'quota', NULL, 'live',     'term',  310),
  ('branches',               'Tổ chức',  'Chi nhánh',                   'chi nhánh', 'quota', NULL, 'display',  'term',  320),
  ('custom_roles',           'Tổ chức',  'Phân quyền tuỳ chỉnh',        'vai trò',   'quota', NULL, 'display',  'term',  330),
  ('api_calls',              'Tích hợp', 'API truy xuất dữ liệu',       'lượt gọi',  'quota', NULL, 'display',  'month', 410),
  ('sso',                    'Tích hợp', 'Đăng nhập SSO',               'kết nối',   'quota', NULL, 'display',  'term',  420),
  ('webhooks',               'Tích hợp', 'Webhook sự kiện',             'endpoint',  'quota', NULL, 'display',  'term',  430),
  ('support_response',       'Hỗ trợ',   'Hỗ trợ ưu tiên',              'giờ',       'level', 'Phản hồi trong {n} giờ', 'display', NULL, 510),
  ('account_manager',        'Hỗ trợ',   'Chuyên viên phụ trách riêng', 'người',     'quota', NULL, 'display',  'term',  520),
  ('training',               'Hỗ trợ',   'Đào tạo trực tuyến',          'buổi',      'quota', NULL, 'display',  'month', 530);

-- ─── 2. Dòng quyền lợi của gói danh mục ──────────────────────────────────────

ALTER TABLE public.owner_subscription_plan_entitlements
  DROP CONSTRAINT owner_sub_plan_ent_supported,
  DROP CONSTRAINT owner_subscription_plan_entitlements_variant_key_fkey,
  DROP CONSTRAINT owner_subscription_plan_entitlements_monthly_quota_check;
ALTER TABLE public.owner_subscription_plan_entitlements RENAME COLUMN variant_key TO benefit_key;
ALTER TABLE public.owner_subscription_plan_entitlements RENAME COLUMN monthly_quota TO quota;
ALTER TABLE public.owner_subscription_plan_entitlements
  ADD COLUMN cycle TEXT,
  ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
-- 3D đứng đầu, báo cáo danh mục thứ hai (đúng thứ tự thẻ gói cũ).
UPDATE public.owner_subscription_plan_entitlements
   SET cycle = 'month', sort_order = CASE benefit_key WHEN 'scan_3d_owner' THEN 1 ELSE 2 END;

-- Chuyển dòng chữ tự do → dòng có cấu trúc. Giá trị seed đều có dạng
-- "<số> <đơn vị>[ / tháng]" | "Không giới hạn" | "Phản hồi trong <số> giờ".
INSERT INTO public.owner_subscription_plan_entitlements (plan_id, benefit_key, quota, cycle, sort_order)
SELECT p.id, b.key,
       CASE
         WHEN b.kind = 'level' THEN substring(x.v->>'value' FROM '(\d+)')::int
         WHEN btrim(x.v->>'value') ~* '^không giới hạn' THEN NULL
         ELSE regexp_replace(substring(btrim(x.v->>'value') FROM '^(\d[\d,.]*)'), '[,.]', '', 'g')::int
       END,
       CASE
         WHEN b.kind = 'level' THEN NULL
         WHEN x.v->>'value' ~ '/ tháng' THEN 'month'
         ELSE b.default_cycle
       END,
       10 + x.ord::int
  FROM public.owner_subscription_plans p
  CROSS JOIN LATERAL jsonb_array_elements(p.benefits) WITH ORDINALITY AS x(v, ord)
  JOIN public.owner_sub_benefits b ON b.label = btrim(x.v->>'label')
 WHERE b.source <> 'enforced'
ON CONFLICT (plan_id, benefit_key) DO NOTHING;

DO $$
BEGIN
  -- Mọi dòng chữ cũ phải chuyển được (nhãn có trong danh mục) — không lặng lẽ mất dòng.
  IF EXISTS (SELECT 1 FROM public.owner_subscription_plans p
               CROSS JOIN LATERAL jsonb_array_elements(p.benefits) v
              WHERE NOT EXISTS (SELECT 1 FROM public.owner_sub_benefits b WHERE b.label = btrim(v->>'label'))) THEN
    RAISE EXCEPTION 'owner_subscription_plans.benefits có nhãn ngoài danh mục — bổ sung danh mục trước';
  END IF;
END $$;

ALTER TABLE public.owner_subscription_plan_entitlements
  ADD CONSTRAINT owner_sub_plan_ent_benefit_fkey FOREIGN KEY (benefit_key)
    REFERENCES public.owner_sub_benefits(key) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT owner_sub_plan_ent_quota_check CHECK (quota IS NULL OR quota > 0),
  ADD CONSTRAINT owner_sub_plan_ent_cycle_check
    CHECK (cycle IS NULL OR cycle IN ('day', 'week', 'month', 'quarter', 'year', 'term'));

ALTER TABLE public.owner_subscription_plans DROP CONSTRAINT owner_subscription_plans_benefits_check;
ALTER TABLE public.owner_subscription_plans DROP COLUMN benefits;

-- ─── 3. Dòng quyền lợi của gói từng Trạm (bản chép lúc mua / gia hạn) ─────────

ALTER TABLE public.owner_subscription_entitlements
  DROP CONSTRAINT owner_sub_ent_supported,
  DROP CONSTRAINT owner_subscription_entitlements_variant_key_fkey,
  DROP CONSTRAINT owner_subscription_entitlements_monthly_quota_check;
ALTER TABLE public.owner_subscription_entitlements RENAME COLUMN variant_key TO benefit_key;
ALTER TABLE public.owner_subscription_entitlements RENAME COLUMN monthly_quota TO quota;
ALTER TABLE public.owner_subscription_entitlements
  ADD COLUMN cycle TEXT,
  ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
UPDATE public.owner_subscription_entitlements
   SET cycle = 'month', sort_order = CASE benefit_key WHEN 'scan_3d_owner' THEN 1 ELSE 2 END;
-- Quyền lợi hiển thị trước đây đọc thẳng từ gói danh mục ⇒ chép vào gói của Trạm.
INSERT INTO public.owner_subscription_entitlements (subscription_id, benefit_key, quota, cycle, sort_order)
SELECT s.id, e.benefit_key, e.quota, e.cycle, e.sort_order
  FROM public.owner_subscriptions s
  JOIN public.owner_subscription_plan_entitlements e ON e.plan_id = s.plan_id
ON CONFLICT (subscription_id, benefit_key) DO NOTHING;
ALTER TABLE public.owner_subscription_entitlements
  ADD CONSTRAINT owner_sub_ent_benefit_fkey FOREIGN KEY (benefit_key)
    REFERENCES public.owner_sub_benefits(key) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT owner_sub_ent_quota_check CHECK (quota IS NULL OR quota > 0),
  ADD CONSTRAINT owner_sub_ent_cycle_check
    CHECK (cycle IS NULL OR cycle IN ('day', 'week', 'month', 'quarter', 'year', 'term'));

-- Ảnh chụp cũ {variant_key, monthly_quota} → {benefit_key, quota, cycle, sort_order}.
CREATE OR REPLACE FUNCTION public._owner_sub_lines_upgrade(p_lines JSONB)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_agg(
           CASE WHEN e ? 'benefit_key' THEN e
                ELSE jsonb_build_object('benefit_key', e->>'variant_key', 'quota', e->'monthly_quota',
                                        'cycle', 'month',
                                        'sort_order', CASE e->>'variant_key' WHEN 'scan_3d_owner' THEN 1 ELSE 2 END)
           END ORDER BY ord), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(p_lines, '[]'::jsonb)) WITH ORDINALITY AS t(e, ord)
$$;
UPDATE public.owner_subscription_terms
   SET entitlements_snapshot = public._owner_sub_lines_upgrade(entitlements_snapshot);
UPDATE public.owner_subscriptions
   SET pending_snapshot = jsonb_set(pending_snapshot, '{entitlements}',
                                    public._owner_sub_lines_upgrade(pending_snapshot->'entitlements'))
 WHERE pending_snapshot IS NOT NULL;

-- ─── 4. Sổ lượt dùng: ngày dùng thay cho tháng ───────────────────────────────

ALTER TABLE public.owner_subscription_usage RENAME COLUMN variant_key TO benefit_key;
ALTER TABLE public.owner_subscription_usage ADD COLUMN used_on DATE;
-- Dòng hoàn giữ ngày của dòng gốc (để trả lại đúng cửa sổ đã trừ).
UPDATE public.owner_subscription_usage
   SET used_on = (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date WHERE reverses_id IS NULL;
UPDATE public.owner_subscription_usage r
   SET used_on = o.used_on FROM public.owner_subscription_usage o WHERE r.reverses_id = o.id;
ALTER TABLE public.owner_subscription_usage ALTER COLUMN used_on SET NOT NULL;
DROP INDEX public.idx_owner_sub_usage_month;
ALTER TABLE public.owner_subscription_usage DROP COLUMN period_month;
CREATE INDEX idx_owner_sub_usage_day ON public.owner_subscription_usage (subscription_id, benefit_key, used_on);
ALTER TABLE public.owner_subscription_usage
  ADD CONSTRAINT owner_sub_usage_benefit_fkey FOREIGN KEY (benefit_key)
    REFERENCES public.owner_sub_benefits(key) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Số giữ chỗ: khớp theo khoá thay vì nhãn chữ.
ALTER TABLE public.owner_subscription_benefit_usage ADD COLUMN benefit_key TEXT;
UPDATE public.owner_subscription_benefit_usage u SET benefit_key = b.key
  FROM public.owner_sub_benefits b WHERE b.label = u.label;
DELETE FROM public.owner_subscription_benefit_usage WHERE benefit_key IS NULL;
ALTER TABLE public.owner_subscription_benefit_usage DROP CONSTRAINT owner_subscription_benefit_usage_pkey;
ALTER TABLE public.owner_subscription_benefit_usage DROP COLUMN label;
ALTER TABLE public.owner_subscription_benefit_usage RENAME COLUMN period_month TO period_start;
ALTER TABLE public.owner_subscription_benefit_usage DROP CONSTRAINT owner_subscription_benefit_usage_period_month_check;
ALTER TABLE public.owner_subscription_benefit_usage
  ALTER COLUMN benefit_key SET NOT NULL,
  ADD PRIMARY KEY (subscription_id, benefit_key, period_start),
  ADD CONSTRAINT owner_sub_benefit_usage_benefit_fkey FOREIGN KEY (benefit_key)
    REFERENCES public.owner_sub_benefits(key) ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 5. Hàm ──────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.owner_sub_benefit_usage(UUID);
DROP FUNCTION IF EXISTS public.admin_owner_sub_upsert(UUID, TEXT, NUMERIC, INTEGER, TEXT, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.admin_owner_sub_activate(UUID, INTEGER, DATE, NUMERIC, TEXT, DATE, TEXT);
DROP FUNCTION IF EXISTS public.owner_sub_supported_variants();

-- Cửa sổ đếm [start, end) chứa ngày p_on của một chu kỳ. NULL = gói không có kỳ chứa ngày đó.
CREATE OR REPLACE FUNCTION public.owner_sub_window(p_cycle TEXT, p_sub_id UUID, p_on DATE DEFAULT public.contract_today())
RETURNS daterange
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_r daterange;
BEGIN
  CASE p_cycle
    WHEN 'day'     THEN RETURN daterange(p_on, p_on + 1);
    WHEN 'week'    THEN RETURN daterange(date_trunc('week', p_on)::date, (date_trunc('week', p_on) + interval '1 week')::date);
    WHEN 'month'   THEN RETURN daterange(date_trunc('month', p_on)::date, (date_trunc('month', p_on) + interval '1 month')::date);
    WHEN 'quarter' THEN RETURN daterange(date_trunc('quarter', p_on)::date, (date_trunc('quarter', p_on) + interval '3 months')::date);
    WHEN 'year'    THEN RETURN daterange(date_trunc('year', p_on)::date, (date_trunc('year', p_on) + interval '1 year')::date);
    WHEN 'term' THEN
      SELECT daterange(t.starts_on, t.ends_on, '[]') INTO v_r
        FROM public.owner_subscription_terms t
       WHERE t.subscription_id = p_sub_id AND p_on BETWEEN t.starts_on AND t.ends_on
       ORDER BY t.starts_on DESC LIMIT 1;
      IF v_r IS NULL THEN
        SELECT daterange(s.starts_on, s.ends_on, '[]') INTO v_r
          FROM public.owner_subscriptions s
         WHERE s.id = p_sub_id AND p_on BETWEEN s.starts_on AND s.ends_on;
      END IF;
      RETURN v_r;
    ELSE RETURN NULL;
  END CASE;
END;
$$;
REVOKE ALL ON FUNCTION public.owner_sub_window(TEXT, UUID, DATE) FROM PUBLIC, anon, authenticated;

-- Dòng quyền lợi của một gói Trạm dạng JSON (ảnh chụp kỳ, sự kiện).
CREATE OR REPLACE FUNCTION public._owner_sub_ent_json(p_sub_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('benefit_key', e.benefit_key, 'quota', e.quota,
                                               'cycle', e.cycle, 'sort_order', e.sort_order)
                            ORDER BY e.sort_order, e.benefit_key), '[]'::jsonb)
    FROM public.owner_subscription_entitlements e WHERE e.subscription_id = p_sub_id
$$;

-- Ghi lại toàn bộ dòng quyền lợi của gói Trạm (nhận cả định dạng ảnh chụp cũ).
CREATE OR REPLACE FUNCTION public._owner_sub_set_entitlements(p_sub_id UUID, p_entitlements JSONB)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.owner_subscription_entitlements WHERE subscription_id = p_sub_id;
  INSERT INTO public.owner_subscription_entitlements (subscription_id, benefit_key, quota, cycle, sort_order)
  SELECT p_sub_id, e->>'benefit_key',
         CASE WHEN jsonb_typeof(e->'quota') = 'number' THEN (e->>'quota')::int END,
         NULLIF(e->>'cycle', ''),
         COALESCE((e->>'sort_order')::int, ord::int)
    FROM jsonb_array_elements(public._owner_sub_lines_upgrade(p_entitlements)) WITH ORDINALITY AS t(e, ord);
END;
$$;

CREATE OR REPLACE FUNCTION public._owner_sub_plan_snapshot(p_plan_id UUID)
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'plan_id', p.id, 'name', p.name, 'tier', p.tier, 'overage_mode', p.overage_mode,
    'entitlements', (SELECT COALESCE(jsonb_agg(jsonb_build_object('benefit_key', e.benefit_key,
                              'quota', e.quota, 'cycle', e.cycle, 'sort_order', e.sort_order)
                              ORDER BY e.sort_order, e.benefit_key), '[]'::jsonb)
                       FROM public.owner_subscription_plan_entitlements e WHERE e.plan_id = p.id))
    FROM public.owner_subscription_plans p WHERE p.id = p_plan_id
$$;

CREATE OR REPLACE FUNCTION public._owner_sub_apply_term(p_sub owner_subscriptions, p_start date, p_months integer, p_amount numeric, p_source text, p_method text, p_txn_ref text, p_order_id uuid, p_paid_on date, p_note text, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_end  DATE := public.owner_sub_term_end(p_start, p_months);
  v_term UUID;
BEGIN
  INSERT INTO public.owner_subscription_terms
    (subscription_id, workspace_id, starts_on, ends_on, months, amount_vnd, source, method,
     payment_txn_ref, order_id, paid_on, entitlements_snapshot, overage_mode_snapshot,
     price_snapshot, note, created_by)
  VALUES (p_sub.id, p_sub.workspace_id, p_start, v_end, p_months, p_amount, p_source, p_method,
          p_txn_ref, p_order_id, p_paid_on, public._owner_sub_ent_json(p_sub.id),
          p_sub.overage_mode, p_sub.price_vnd, NULLIF(btrim(COALESCE(p_note, '')), ''), p_actor)
  RETURNING id INTO v_term;

  -- Còn hạn ⇒ giữ ngày bắt đầu gốc, chỉ nối ends_on. Đã hết hạn / lần đầu ⇒ mở kỳ mới.
  UPDATE public.owner_subscriptions
     SET status = 'active',
         starts_on = CASE WHEN status = 'active' AND ends_on >= public.contract_today()
                          THEN starts_on ELSE p_start END,
         ends_on = v_end, cancelled_at = NULL, cancel_reason = NULL, updated_by = p_actor
   WHERE id = p_sub.id;

  RETURN jsonb_build_object('term_id', v_term, 'starts_on', p_start, 'ends_on', v_end);
END;
$function$;

CREATE OR REPLACE FUNCTION public._owner_sub_plan_apply(p_sub owner_subscriptions, p_plan_id uuid, p_effect text, p_start date, p_months integer, p_amount numeric, p_source text, p_method text, p_txn_ref text, p_order_id uuid, p_paid_on date, p_note text, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_sub    public.owner_subscriptions%ROWTYPE := p_sub;
  v_snap   JSONB := public._owner_sub_plan_snapshot(p_plan_id);
  v_end    DATE;
  v_term   UUID;
  v_res    JSONB;
  v_before JSONB;
BEGIN
  IF p_effect = 'next_term' THEN
    v_end := public.owner_sub_term_end(p_start, p_months);
    INSERT INTO public.owner_subscription_terms
      (subscription_id, workspace_id, starts_on, ends_on, months, amount_vnd, source, method,
       payment_txn_ref, order_id, paid_on, entitlements_snapshot, overage_mode_snapshot,
       price_snapshot, plan_id, note, created_by)
    VALUES (v_sub.id, v_sub.workspace_id, p_start, v_end, p_months, p_amount, p_source, p_method,
            p_txn_ref, p_order_id, p_paid_on, v_snap->'entitlements', v_snap->>'overage_mode',
            p_amount, p_plan_id, NULLIF(btrim(COALESCE(p_note, '')), ''), p_actor)
    RETURNING id INTO v_term;
    UPDATE public.owner_subscriptions
       SET ends_on = v_end, pending_plan_id = p_plan_id, pending_from = p_start,
           pending_months = p_months, pending_price_vnd = p_amount, pending_snapshot = v_snap,
           updated_by = p_actor
     WHERE id = v_sub.id;
    v_res := jsonb_build_object('term_id', v_term, 'starts_on', p_start, 'ends_on', v_end);
  ELSE
    v_before := jsonb_build_object(
      'plan_id', v_sub.plan_id, 'plan_name', v_sub.plan_name, 'status', v_sub.status,
      'price_vnd', v_sub.price_vnd, 'term_months', v_sub.term_months, 'overage_mode', v_sub.overage_mode,
      'entitlements', public._owner_sub_ent_json(v_sub.id));
    PERFORM public._owner_sub_set_entitlements(v_sub.id, v_snap->'entitlements');
    UPDATE public.owner_subscriptions
       SET plan_id = p_plan_id, plan_name = v_snap->>'name', overage_mode = v_snap->>'overage_mode',
           price_vnd = p_amount, term_months = p_months, updated_by = p_actor
     WHERE id = v_sub.id
    RETURNING * INTO v_sub;
    v_res := public._owner_sub_apply_term(v_sub, p_start, p_months, p_amount, p_source, p_method, p_txn_ref,
                                          p_order_id, p_paid_on, p_note, p_actor);
    UPDATE public.owner_subscription_terms SET plan_id = p_plan_id WHERE id = (v_res->>'term_id')::uuid;
  END IF;
  RETURN v_res || jsonb_build_object('plan', v_snap, 'replaced', v_before);
END;
$function$;

-- Trừ hạn mức một quyền lợi 'enforced'. Giữ nguyên chữ ký + kết quả cũ; cửa sổ đếm theo chu kỳ.
CREATE OR REPLACE FUNCTION public._owner_sub_consume(p_workspace_id uuid, p_variant_key text, p_qty integer, p_ref_type text, p_ref_id uuid, p_actor uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_sub   public.owner_subscriptions%ROWTYPE;
  v_quota INTEGER;
  v_cycle TEXT;
  v_has   BOOLEAN;
  v_today DATE := public.contract_today();
  v_win   daterange;
  v_used  INTEGER;
  v_id    UUID;
BEGIN
  IF p_workspace_id IS NULL OR p_actor IS NULL OR COALESCE(p_qty, 0) <= 0 THEN
    RETURN jsonb_build_object('mode', 'none');
  END IF;

  -- Chỉ thành viên TRỰC TIẾP đang hoạt động (trụ sở xem qua liên kết không được bao).
  IF NOT EXISTS (SELECT 1 FROM public.asset_owner_workspace_members m
                  WHERE m.workspace_id = p_workspace_id AND m.user_id = p_actor
                    AND m.status = 'active') THEN
    RETURN jsonb_build_object('mode', 'none');
  END IF;

  PERFORM public._owner_sub_roll(s.id) FROM public.owner_subscriptions s WHERE s.workspace_id = p_workspace_id;

  SELECT * INTO v_sub FROM public.owner_subscriptions
   WHERE workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND OR v_sub.status <> 'active'
     OR v_today NOT BETWEEN v_sub.starts_on AND v_sub.ends_on THEN
    RETURN jsonb_build_object('mode', 'none');
  END IF;

  SELECT true, e.quota, COALESCE(e.cycle, 'month') INTO v_has, v_quota, v_cycle
    FROM public.owner_subscription_entitlements e
    JOIN public.owner_sub_benefits b ON b.key = e.benefit_key AND b.source = 'enforced'
   WHERE e.subscription_id = v_sub.id AND e.benefit_key = p_variant_key;
  IF v_has IS NULL THEN
    RETURN jsonb_build_object('mode', 'none');
  END IF;
  v_win := COALESCE(public.owner_sub_window(v_cycle, v_sub.id, v_today), daterange(v_today, v_today + 1));

  SELECT COALESCE(SUM(u.qty), 0) INTO v_used
    FROM public.owner_subscription_usage u
   WHERE u.subscription_id = v_sub.id AND u.benefit_key = p_variant_key AND u.used_on <@ v_win;

  IF v_quota IS NULL OR v_used + p_qty <= v_quota THEN
    INSERT INTO public.owner_subscription_usage
      (subscription_id, workspace_id, benefit_key, used_on, qty, ref_type, ref_id, actor_id)
    VALUES (v_sub.id, p_workspace_id, p_variant_key, v_today, p_qty, p_ref_type, p_ref_id, p_actor)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('mode', 'covered', 'usage_id', v_id, 'quota', v_quota, 'cycle', v_cycle,
                              'used', v_used + p_qty,
                              'remaining', CASE WHEN v_quota IS NULL THEN NULL
                                                ELSE v_quota - v_used - p_qty END);
  END IF;

  RETURN jsonb_build_object(
    'mode', CASE v_sub.overage_mode WHEN 'block' THEN 'blocked' ELSE 'fallback' END,
    'quota', v_quota, 'cycle', v_cycle, 'used', v_used, 'remaining', GREATEST(v_quota - v_used, 0));
END;
$function$;

CREATE OR REPLACE FUNCTION public._owner_sub_reverse(p_usage_id uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.owner_subscription_usage
    (subscription_id, workspace_id, benefit_key, used_on, qty, ref_type, ref_id,
     reverses_id, actor_id, note)
  SELECT u.subscription_id, u.workspace_id, u.benefit_key, u.used_on, -u.qty,
         u.ref_type, u.ref_id, u.id, u.actor_id, p_note
    FROM public.owner_subscription_usage u
   WHERE u.id = p_usage_id AND u.qty > 0
  ON CONFLICT (reverses_id) DO NOTHING;
END;
$function$;

-- Mọi dòng quyền lợi của gói Trạm kèm lượt dùng trong cửa sổ hiện tại.
--   tracked = có số lượt dùng để lên thẻ Hạn mức (enforced / live / display đã có số giữ chỗ).
--   resets_on = ngày làm mới kế tiếp (NULL: chu kỳ 'term', dạng 'level' hoặc ngoài kỳ).
CREATE OR REPLACE FUNCTION public._owner_sub_lines(p_sub_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_ws    UUID;
  v_today DATE := public.contract_today();
  v_out   JSONB := '[]'::jsonb;
  r       RECORD;
  v_win   daterange;
  v_used  INTEGER;
  v_track BOOLEAN;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.owner_subscriptions WHERE id = p_sub_id;
  FOR r IN
    SELECT e.benefit_key, e.quota, e.cycle, e.sort_order, b.group_name, b.label, b.unit, b.kind,
           b.level_format, b.source, v.credit_cost
      FROM public.owner_subscription_entitlements e
      JOIN public.owner_sub_benefits b ON b.key = e.benefit_key
      LEFT JOIN public.service_variants v ON b.source = 'enforced' AND v.variant_key = e.benefit_key
     WHERE e.subscription_id = p_sub_id
     ORDER BY e.sort_order, b.sort_order
  LOOP
    v_win := CASE WHEN r.kind = 'quota' THEN public.owner_sub_window(r.cycle, p_sub_id, v_today) END;
    v_used := 0;
    v_track := r.kind = 'quota';
    IF NOT v_track THEN
      v_used := NULL;
    ELSIF r.source = 'enforced' THEN
      SELECT COALESCE(SUM(u.qty), 0)::int INTO v_used FROM public.owner_subscription_usage u
       WHERE u.subscription_id = p_sub_id AND u.benefit_key = r.benefit_key AND u.used_on <@ v_win;
    ELSIF r.benefit_key = 'members' THEN
      -- Trần số thành viên: đếm hiện tại, không theo cửa sổ.
      SELECT count(*)::int INTO v_used FROM public.asset_owner_workspace_members
       WHERE workspace_id = v_ws AND status = 'active';
    ELSIF r.benefit_key = 'digitize_posting' THEN
      SELECT count(*)::int INTO v_used FROM public.asset_postings
       WHERE workspace_id = v_ws AND (created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <@ v_win;
    ELSIF EXISTS (SELECT 1 FROM public.owner_subscription_benefit_usage x
                   WHERE x.subscription_id = p_sub_id AND x.benefit_key = r.benefit_key) THEN
      SELECT COALESCE(SUM(x.used), 0)::int INTO v_used FROM public.owner_subscription_benefit_usage x
       WHERE x.subscription_id = p_sub_id AND x.benefit_key = r.benefit_key AND x.period_start <@ v_win;
    ELSE
      v_track := false;
    END IF;

    v_out := v_out || jsonb_build_object(
      'benefit_key', r.benefit_key, 'group', r.group_name, 'label', r.label, 'unit', r.unit,
      'kind', r.kind, 'level_format', r.level_format, 'source', r.source,
      'quota', r.quota, 'cycle', r.cycle, 'credit_cost', r.credit_cost,
      'tracked', v_track, 'used', GREATEST(COALESCE(v_used, 0), 0),
      'remaining', CASE WHEN r.kind <> 'quota' OR r.quota IS NULL THEN NULL
                        ELSE GREATEST(r.quota - COALESCE(v_used, 0), 0) END,
      'window_start', lower(v_win),
      'resets_on', CASE WHEN r.kind = 'quota' AND r.cycle <> 'term' THEN upper(v_win) END);
  END LOOP;
  RETURN v_out;
END;
$function$;

-- Lưu một gói danh mục. p_benefits = mảng {benefit_key, quota, cycle} theo THỨ TỰ hiển thị,
-- THAY TOÀN BỘ. Sửa danh mục KHÔNG đổi gói Trạm đã mua (áp từ lần mua / gia hạn sau).
DROP FUNCTION IF EXISTS public.admin_owner_sub_plan_upsert(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, BOOLEAN, INTEGER, JSONB, JSONB);
CREATE OR REPLACE FUNCTION public.admin_owner_sub_plan_upsert(
  p_plan_id UUID, p_name TEXT, p_fit_line TEXT, p_highlight_line TEXT, p_tier TEXT,
  p_monthly_price_vnd NUMERIC, p_overage_mode TEXT, p_is_featured BOOLEAN, p_is_active BOOLEAN,
  p_sort_order INTEGER, p_benefits JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_id   UUID := p_plan_id;
  v_line JSONB;
  v_key  TEXT;
  v_kind TEXT;
  v_seen TEXT[] := '{}';
BEGIN
  IF v_id IS NULL AND NOT public.admin_has_permission('goi-thue-bao', 'create') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF v_id IS NOT NULL AND NOT public.admin_has_permission('goi-thue-bao', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF char_length(btrim(COALESCE(p_name, ''))) NOT BETWEEN 2 AND 60 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_name');
  END IF;
  IF p_tier NOT IN ('basic', 'standard', 'premium') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_tier');
  END IF;
  IF p_overage_mode NOT IN ('block', 'credits') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_overage');
  END IF;
  IF p_monthly_price_vnd IS NULL OR p_monthly_price_vnd < 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;
  IF char_length(COALESCE(p_fit_line, '')) > 120 OR char_length(COALESCE(p_highlight_line, '')) > 120 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_text');
  END IF;

  IF jsonb_typeof(COALESCE(p_benefits, 'null'::jsonb)) <> 'array' OR jsonb_array_length(p_benefits) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_benefits');
  END IF;
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_benefits) LOOP
    v_key := v_line->>'benefit_key';
    SELECT kind INTO v_kind FROM public.owner_sub_benefits WHERE key = v_key;
    IF v_kind IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'unknown_benefit', 'benefit_key', v_key);
    END IF;
    IF v_key = ANY (v_seen) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_benefit', 'benefit_key', v_key);
    END IF;
    v_seen := v_seen || v_key;
    IF v_kind = 'quota' THEN
      IF NOT (jsonb_typeof(v_line->'quota') = 'null' OR v_line->'quota' IS NULL
              OR (jsonb_typeof(v_line->'quota') = 'number' AND (v_line->>'quota')::numeric > 0
                  AND (v_line->>'quota')::numeric = floor((v_line->>'quota')::numeric)
                  AND (v_line->>'quota')::numeric <= 2000000000))
         OR COALESCE(v_line->>'cycle', '') NOT IN ('day', 'week', 'month', 'quarter', 'year', 'term') THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_benefit', 'benefit_key', v_key);
      END IF;
    ELSE
      IF jsonb_typeof(v_line->'quota') IS DISTINCT FROM 'number' OR (v_line->>'quota')::numeric <= 0
         OR (v_line->>'quota')::numeric <> floor((v_line->>'quota')::numeric)
         OR (v_line->>'quota')::numeric > 2000000000 THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'invalid_benefit', 'benefit_key', v_key);
      END IF;
    END IF;
  END LOOP;

  IF COALESCE(p_is_featured, false) THEN
    UPDATE public.owner_subscription_plans SET is_featured = false
     WHERE is_featured AND id IS DISTINCT FROM v_id;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.owner_subscription_plans
      (name, fit_line, highlight_line, tier, monthly_price_vnd, overage_mode, is_featured,
       is_active, sort_order, created_by, updated_by)
    VALUES (btrim(p_name), NULLIF(btrim(COALESCE(p_fit_line, '')), ''),
            NULLIF(btrim(COALESCE(p_highlight_line, '')), ''), p_tier, p_monthly_price_vnd,
            p_overage_mode, COALESCE(p_is_featured, false), COALESCE(p_is_active, true),
            COALESCE(p_sort_order, 0), v_uid, v_uid)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.owner_subscription_plans
       SET name = btrim(p_name), fit_line = NULLIF(btrim(COALESCE(p_fit_line, '')), ''),
           highlight_line = NULLIF(btrim(COALESCE(p_highlight_line, '')), ''), tier = p_tier,
           monthly_price_vnd = p_monthly_price_vnd, overage_mode = p_overage_mode,
           is_featured = COALESCE(p_is_featured, false), is_active = COALESCE(p_is_active, true),
           sort_order = COALESCE(p_sort_order, 0), updated_by = v_uid
     WHERE id = v_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  END IF;

  DELETE FROM public.owner_subscription_plan_entitlements WHERE plan_id = v_id;
  INSERT INTO public.owner_subscription_plan_entitlements (plan_id, benefit_key, quota, cycle, sort_order)
  SELECT v_id, e->>'benefit_key',
         CASE WHEN jsonb_typeof(e->'quota') = 'number' THEN (e->>'quota')::int END,
         CASE WHEN b.kind = 'quota' THEN e->>'cycle' END,
         ord::int
    FROM jsonb_array_elements(p_benefits) WITH ORDINALITY AS t(e, ord)
    JOIN public.owner_sub_benefits b ON b.key = e->>'benefit_key';

  RETURN jsonb_build_object('ok', true, 'plan_id', v_id, 'created', p_plan_id IS NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_owner_sub_plan_upsert(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, BOOLEAN, INTEGER, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owner_sub_plan_upsert(UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT, BOOLEAN, BOOLEAN, INTEGER, JSONB) TO authenticated;

-- Hàm nội bộ: PostgREST phơi mọi hàm authenticated gọi được ⇒ thu quyền.
REVOKE ALL ON FUNCTION public._owner_sub_ent_json(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._owner_sub_lines_upgrade(JSONB) FROM PUBLIC, anon, authenticated;
