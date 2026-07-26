-- CTA "Sử dụng dịch vụ" trên MKP → tạo Lead + Cơ hội (stage 'selling').
--
-- Bắt buộc đăng nhập: RPC grant CHO authenticated (không anon). Đây là RPC cho
-- END-USER nên KHÔNG gọi admin_has_permission — SECURITY DEFINER để ghi vào
-- leads/opportunities (vốn chỉ có policy admin_all). Admin sau đó chốt thắng qua
-- admin_win_opportunity như thường → lead→khách hàng + đơn hàng + hoa hồng.

-- ─── leads.source: thêm giá trị 'tool_marketplace' ───────────────────────────

DO $$
DECLARE v_name TEXT;
BEGIN
  SELECT conname INTO v_name
  FROM pg_constraint
  WHERE conrelid = 'public.leads'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%source%';
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.leads DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_source_check
    CHECK (source IN ('contact_form','partnership_form','hotline','email',
                      'referral','event','ads','tool_marketplace','other'));

-- ─── Truy vết nguồn gốc công cụ (báo cáo "doanh thu theo công cụ" về sau) ─────

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS tool_provider_id UUID
    REFERENCES public.auction_tool_providers(id) ON DELETE SET NULL;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS tool_provider_id UUID
    REFERENCES public.auction_tool_providers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_tool_provider
  ON public.opportunities (tool_provider_id) WHERE tool_provider_id IS NOT NULL;

-- ─── request_tool_service ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.request_tool_service(
  _provider_id UUID,
  _note        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_provider public.auction_tool_providers%ROWTYPE;
  v_tool     public.auction_tools%ROWTYPE;
  v_variant  public.service_variants%ROWTYPE;
  v_prof     RECORD;
  v_lead     UUID;
  v_opp      UUID;
  v_gross    NUMERIC(18,0) := 0;
  v_ctype    TEXT;
  v_cvalue   NUMERIC(12,2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Vui lòng đăng nhập để gửi yêu cầu' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_provider FROM public.auction_tool_providers
   WHERE id = _provider_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy đơn vị cung cấp' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_provider.service_id IS NULL THEN
    RAISE EXCEPTION 'Dịch vụ chưa sẵn sàng — vui lòng liên hệ tư vấn' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_tool FROM public.auction_tools WHERE id = v_provider.tool_id;

  -- Chống trùng: đã có cơ hội ĐANG MỞ của chính user cho provider này.
  SELECT o.id, o.lead_id INTO v_opp, v_lead
    FROM public.opportunities o
   WHERE o.tool_provider_id = _provider_id
     AND o.created_by = v_uid
     AND o.stage IN ('selling', 'pending_approval')
   LIMIT 1;
  IF v_opp IS NOT NULL THEN
    RETURN jsonb_build_object('opportunity_id', v_opp, 'lead_id', v_lead, 'deduped', true);
  END IF;

  -- Điều khoản hoa hồng lấy từ biến thể (chỉ có ý nghĩa với service commission).
  IF v_provider.service_variant_id IS NOT NULL THEN
    SELECT * INTO v_variant FROM public.service_variants WHERE id = v_provider.service_variant_id;
    IF FOUND THEN
      v_gross  := COALESCE(v_variant.price, 0);
      v_ctype  := v_variant.commission_type;
      v_cvalue := v_variant.commission_value;
    END IF;
  END IF;

  SELECT name, email INTO v_prof FROM public.profiles WHERE id = v_uid;

  -- Lead: liên hệ lấy từ profile (profiles không có phone → để trống, admin bổ sung).
  INSERT INTO public.leads
    (name, contact_name, phone, email, lead_type, source, status, note, created_by, tool_provider_id)
  VALUES (
    COALESCE(NULLIF(v_prof.name, ''), v_prof.email, 'Khách hàng'),
    v_prof.name, NULL, v_prof.email,
    'other', 'tool_marketplace', 'new',
    COALESCE(NULLIF(_note, ''),
             'Yêu cầu dịch vụ "' || v_tool.name || '" — ' || v_provider.name || ' (từ MKP)'),
    v_uid, _provider_id
  )
  RETURNING id INTO v_lead;

  -- Cơ hội gắn lead + service của provider. Trigger opportunities_sync_close tự
  -- snapshot service_kind. amount (net dự kiến) để admin điền lúc chốt.
  INSERT INTO public.opportunities
    (name, lead_id, opportunity_type, stage, service_id, service_variant_id,
     amount, gross_amount, commission_type, commission_value, created_by, tool_provider_id)
  VALUES (
    v_tool.name || ' – ' || v_provider.name,
    v_lead, 'new_business', 'selling',
    v_provider.service_id, v_provider.service_variant_id,
    0, v_gross, v_ctype, v_cvalue, v_uid, _provider_id
  )
  RETURNING id INTO v_opp;

  RETURN jsonb_build_object('opportunity_id', v_opp, 'lead_id', v_lead, 'deduped', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_tool_service(UUID, TEXT) TO authenticated;
