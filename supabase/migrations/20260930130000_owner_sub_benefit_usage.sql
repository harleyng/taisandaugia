-- Lượt dùng quyền lợi gói (ngoài 2 tính năng tính hạn mức) cho thẻ "Hạn mức tháng" (2026-09-30).
--
-- Thẻ hạn mức trong design hiện "đã dùng / hạn mức" cho cả những quyền lợi tự nhập của gói
-- danh mục (Số hoá hồ sơ 31 / 50, Thư mời 640 / 1,000…). Hệ thống KHÔNG đếm các quyền lợi
-- này, nên số liệu lấy từ 2 nguồn:
--   • 'live' — đếm thật, đồng nhất với màn khác của cổng:
--       "Thành viên"   = thành viên đang hoạt động của Trạm (không theo tháng),
--       "Số hoá hồ sơ" = hồ sơ Trạm tạo trong tháng (giờ VN).
--   • 'demo' — bảng owner_subscription_benefit_usage, DỮ LIỆU GIỮ CHỖ nhập tay (chưa có tính
--     năng nào ghi vào). Quyền lợi chỉ lên thẻ khi đã từng có dòng cho gói đó; sang tháng mới
--     chưa có dòng ⇒ 0 (hạn mức làm mới).
-- Hạn mức đọc từ chữ của quyền lợi: "Không giới hạn" ⇒ NULL, "1,000 thư / tháng" ⇒ 1000;
-- không đọc được số ⇒ không lên thẻ. Khớp nhãn theo chữ — admin đổi nhãn thì mất liên kết.

CREATE TABLE public.owner_subscription_benefit_usage (
  subscription_id UUID NOT NULL REFERENCES public.owner_subscriptions(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  period_month    DATE NOT NULL CHECK (period_month = date_trunc('month', period_month)::date),
  used            INTEGER NOT NULL CHECK (used >= 0),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (subscription_id, label, period_month)
);
-- Đọc qua RPC; không policy nào ⇒ client không đọc / ghi trực tiếp.
ALTER TABLE public.owner_subscription_benefit_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_subscription_benefit_usage FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_sub_benefit_usage(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub      public.owner_subscriptions%ROWTYPE;
  v_benefits JSONB;
  v_month    DATE := public.owner_sub_month();
  v_out      JSONB := '[]'::jsonb;
  v_b        JSONB;
  v_label    TEXT;
  v_value    TEXT;
  v_num      TEXT;
  v_quota    INTEGER;
  v_used     INTEGER;
  v_source   TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.owner_ws_can(p_workspace_id, 'read')
                                OR public.admin_has_permission('goi-thue-bao', 'view')) THEN
    RETURN '[]'::jsonb;
  END IF;
  SELECT * INTO v_sub FROM public.owner_subscriptions WHERE workspace_id = p_workspace_id;
  IF NOT FOUND OR v_sub.plan_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  SELECT benefits INTO v_benefits FROM public.owner_subscription_plans WHERE id = v_sub.plan_id;

  FOR v_b IN SELECT * FROM jsonb_array_elements(COALESCE(v_benefits, '[]'::jsonb)) LOOP
    v_label := btrim(v_b->>'label');
    v_value := btrim(v_b->>'value');
    IF v_value ~* '^không giới hạn' THEN
      v_quota := NULL;
    ELSE
      v_num := substring(v_value FROM '^(\d[\d,.]*)');
      CONTINUE WHEN v_num IS NULL;
      v_quota := regexp_replace(v_num, '[,.]', '', 'g')::int;
    END IF;

    IF v_label = 'Thành viên' THEN
      v_source := 'live';
      SELECT count(*) INTO v_used FROM public.asset_owner_workspace_members
       WHERE workspace_id = p_workspace_id AND status = 'active';
    ELSIF v_label = 'Số hoá hồ sơ' THEN
      v_source := 'live';
      SELECT count(*) INTO v_used FROM public.asset_postings
       WHERE workspace_id = p_workspace_id AND public.owner_sub_month(created_at) = v_month;
    ELSE
      v_source := 'demo';
      CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.owner_subscription_benefit_usage u
                                 WHERE u.subscription_id = v_sub.id AND u.label = v_label);
      SELECT COALESCE(max(u.used), 0) INTO v_used FROM public.owner_subscription_benefit_usage u
       WHERE u.subscription_id = v_sub.id AND u.label = v_label AND u.period_month = v_month;
    END IF;

    v_out := v_out || jsonb_build_object(
      'group', btrim(v_b->>'group'), 'label', v_label, 'value', v_value,
      'quota', v_quota, 'used', v_used, 'source', v_source);
  END LOOP;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.owner_sub_benefit_usage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_sub_benefit_usage(UUID) TO authenticated;
