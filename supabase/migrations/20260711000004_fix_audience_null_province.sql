-- Cho phép nhắm riêng nhóm người dùng CHƯA XÁC ĐỊNH tỉnh/thành.
--
-- Trước đây điều kiện tỉnh/thành là:
--     array_length(provs,1) IS NULL OR b.province = ANY(provs) OR (incl_null AND b.province IS NULL)
-- => khi provs rỗng thì "array_length IS NULL" luôn đúng nên KHÔNG lọc tỉnh, và cờ
--    includeNullProvince bị bỏ qua nếu không chọn tỉnh cụ thể nào. Vì vậy "Chưa xác định"
--    đứng một mình không có tác dụng (khớp toàn bộ).
--
-- Sau khi sửa: bộ lọc tỉnh CHỈ bị bỏ qua khi vừa không chọn tỉnh VỪA không bật "Chưa xác định".
-- Nếu chỉ bật "Chưa xác định" (provs rỗng) thì khớp đúng người có province IS NULL.
--
-- Đồng thời đổi mặc định includeNullProvince: true -> false (khớp UI mới, coi "Chưa xác định"
-- là 1 lựa chọn người dùng chủ động bật, không tự kèm).

CREATE OR REPLACE FUNCTION public.resolve_campaign_audience(
  _spec          JSONB,
  _respect_optin BOOLEAN DEFAULT true,
  _limit         INT     DEFAULT NULL,
  _offset        INT     DEFAULT 0
)
RETURNS TABLE(user_id UUID, email TEXT, name TEXT, total_count BIGINT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c        JSONB   := COALESCE(_spec -> 'criteria', '{}'::jsonb);
  modes    JSONB   := COALESCE(_spec -> 'modes', '{}'::jsonb);
  crit_on  BOOLEAN := COALESCE((modes ->> 'criteria')::boolean, false);
  mode_spec BOOLEAN := COALESCE((modes ->> 'specific')::boolean, false);
  mode_imp  BOOLEAN := COALESCE((modes ->> 'import')::boolean, false);
  reg_from DATE    := NULLIF(c -> 'registration' ->> 'from', '')::date;
  reg_to   DATE    := NULLIF(c -> 'registration' ->> 'to', '')::date;
  credit_min NUMERIC := NULLIF(c -> 'credit' ->> 'min', '')::numeric;
  credit_max NUMERIC := NULLIF(c -> 'credit' ->> 'max', '')::numeric;
  incl_null_prov BOOLEAN := COALESCE((c ->> 'includeNullProvince')::boolean, false);
  user_ids UUID[];
  emails   TEXT[];
  acct     TEXT[];
  kycs     TEXT[];
  provs    TEXT[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COALESCE(array_agg(t.x::uuid), ARRAY[]::uuid[]) INTO user_ids
    FROM jsonb_array_elements_text(COALESCE(_spec -> 'userIds', '[]'::jsonb)) AS t(x);
  SELECT COALESCE(array_agg(lower(t.x)), ARRAY[]::text[]) INTO emails
    FROM jsonb_array_elements_text(COALESCE(_spec -> 'emails', '[]'::jsonb)) AS t(x);
  SELECT COALESCE(array_agg(t.x), ARRAY[]::text[]) INTO acct
    FROM jsonb_array_elements_text(COALESCE(c -> 'accountTypes', '[]'::jsonb)) AS t(x);
  SELECT COALESCE(array_agg(t.x), ARRAY[]::text[]) INTO kycs
    FROM jsonb_array_elements_text(COALESCE(c -> 'kycStatuses', '[]'::jsonb)) AS t(x);
  SELECT COALESCE(array_agg(t.x), ARRAY[]::text[]) INTO provs
    FROM jsonb_array_elements_text(COALESCE(c -> 'provinces', '[]'::jsonb)) AS t(x);

  RETURN QUERY
  WITH base AS (
    SELECT
      p.id,
      p.email,
      p.name,
      p.created_at,
      p.kyc_status,
      p.notifications_enabled,
      EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id = p.id AND r.role = 'ADMIN'::app_role) AS is_admin,
      (EXISTS(SELECT 1 FROM organizations o WHERE o.owner_id = p.id)
       OR EXISTS(SELECT 1 FROM organization_memberships m WHERE m.user_id = p.id))            AS is_company_rep,
      EXISTS(SELECT 1 FROM asset_owner_kyc k WHERE k.user_id = p.id)                          AS is_owner_individual,
      EXISTS(SELECT 1 FROM asset_owner_org_kyc ok WHERE ok.created_by = p.id)                 AS is_owner_org,
      COALESCE(uc.balance, 0) AS credit_balance,
      COALESCE(
        (SELECT ao.province FROM organizations o
           JOIN auction_organizations ao ON ao.id::text = (o.license_info ->> 'auction_org_id')
          WHERE o.owner_id = p.id AND ao.province IS NOT NULL LIMIT 1),
        (SELECT ao.province FROM organization_memberships m
           JOIN organizations o ON o.id = m.organization_id
           JOIN auction_organizations ao ON ao.id::text = (o.license_info ->> 'auction_org_id')
          WHERE m.user_id = p.id AND ao.province IS NOT NULL LIMIT 1),
        (SELECT ao.province FROM asset_owner_org_kyc ok
           JOIN auction_organizations ao ON ao.id = ok.linked_auction_org_id
          WHERE ok.created_by = p.id AND ao.province IS NOT NULL LIMIT 1),
        (SELECT ap.province FROM asset_postings ap
          WHERE ap.user_id = p.id AND ap.province IS NOT NULL
          ORDER BY ap.created_at DESC LIMIT 1)
      ) AS province
    FROM profiles p
    LEFT JOIN user_credits uc ON uc.user_id = p.id
  ),
  matched AS (
    SELECT b.* FROM base b
    WHERE
      (
        crit_on
        AND (reg_from IS NULL OR b.created_at >= reg_from)
        AND (reg_to   IS NULL OR b.created_at < (reg_to + 1))
        AND (
          array_length(acct, 1) IS NULL
          OR (b.is_admin            AND 'admin'            = ANY(acct))
          OR (b.is_company_rep      AND 'company_rep'      = ANY(acct))
          OR (b.is_owner_individual AND 'owner_individual' = ANY(acct))
          OR (b.is_owner_org        AND 'owner_org'        = ANY(acct))
          OR (NOT (b.is_admin OR b.is_company_rep OR b.is_owner_individual OR b.is_owner_org)
              AND 'buyer' = ANY(acct))
        )
        AND (array_length(kycs, 1) IS NULL OR b.kyc_status::text = ANY(kycs))
        AND (credit_min IS NULL OR b.credit_balance >= credit_min)
        AND (credit_max IS NULL OR b.credit_balance <= credit_max)
        AND (
          -- Bỏ qua lọc tỉnh CHỈ khi không chọn tỉnh nào VÀ không bật "Chưa xác định".
          (array_length(provs, 1) IS NULL AND NOT incl_null_prov)
          OR b.province = ANY(provs)
          OR (incl_null_prov AND b.province IS NULL)
        )
      )
      OR (mode_spec AND array_length(user_ids, 1) IS NOT NULL AND b.id = ANY(user_ids))
      OR (mode_imp  AND array_length(emails, 1)   IS NOT NULL AND lower(b.email) = ANY(emails))
  ),
  filtered AS (
    SELECT m.* FROM matched m
    WHERE (NOT _respect_optin) OR m.notifications_enabled = true
  )
  SELECT f.id, f.email, f.name, COUNT(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.email
  OFFSET COALESCE(_offset, 0)
  LIMIT _limit;
END;
$$;
