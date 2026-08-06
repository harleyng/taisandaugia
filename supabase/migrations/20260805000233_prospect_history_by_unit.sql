-- Tab "Lịch sử đấu giá" phải nhìn được phân bổ theo chi nhánh và lọc theo đơn vị.
--
-- Tin của chi nhánh nằm ở BẢN GHI CHI NHÁNH (asset_owner_id / auction_org_id trỏ
-- vào đó), nên trước giờ hoàn toàn ngoài tập dữ liệu của công ty mẹ. Muốn phân bổ
-- được thì `history` phải gộp tin của cả cụm, mỗi dòng gắn đơn vị sở hữu.
--
-- "Đơn vị" là MỘT CHIỀU THỐNG NHẤT: công ty mẹ cũng là một lát cắt mang tên chính
-- nó, không phải "phần còn lại" — biểu đồ mới đọc được ai đóng góp bao nhiêu.
--
-- Trần dòng nâng 500 → 1000 vì gộp cụm làm số dòng tăng vài lần; giữ 500 là âm
-- thầm cắt mất tin của chi nhánh cuối danh sách.
--
-- legal_flags / postings_count CỐ Ý giữ phạm vi công ty mẹ: chúng đến từ
-- asset_postings qua workspace claim, khác nguồn với tin đấu giá, gộp vào là sai.

CREATE OR REPLACE FUNCTION public.admin_prospect_detail(p_kind TEXT, p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name    TEXT;
  v_addr    TEXT;
  v_aliases TEXT[];
  v_entity  TEXT;
  v_subtype TEXT;
  v_parent  JSONB := NULL;
  v_pid     UUID;
  v_result  JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_kind NOT IN ('asset_owner', 'auction_org') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;

  IF p_kind = 'asset_owner' THEN
    SELECT o.name, o.address, o.aliases,
           CASE WHEN COALESCE(o.owner_kind, 'other') = 'individual'
                THEN 'individual' ELSE 'organization' END,
           COALESCE(o.owner_kind, 'other'),
           o.parent_owner_id
      INTO v_name, v_addr, v_aliases, v_entity, v_subtype, v_pid
    FROM public.asset_owners o WHERE o.id = p_id;

    IF v_pid IS NOT NULL THEN
      SELECT jsonb_build_object('id', po.id, 'name', po.name)
        INTO v_parent
      FROM public.asset_owners po WHERE po.id = v_pid;
    END IF;
  ELSE
    SELECT a.name, a.address, '{}'::TEXT[], 'organization',
           CASE a.org_type
             WHEN 0  THEN 'center'
             WHEN 1  THEN 'enterprise'
             WHEN 2  THEN 'company'
             WHEN 11 THEN 'branch'
             ELSE 'other'
           END,
           a.parent_org_id
      INTO v_name, v_addr, v_aliases, v_entity, v_subtype, v_pid
    FROM public.auction_organizations a WHERE a.id = p_id;

    IF v_pid IS NOT NULL THEN
      SELECT jsonb_build_object('id', pa.id, 'name', pa.name)
        INTO v_parent
      FROM public.auction_organizations pa WHERE pa.id = v_pid;
    END IF;
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'not_found';
  END IF;

  WITH units AS (
    -- Chính nó + các đơn vị trực thuộc. Một cấp là đủ: chi nhánh của chi nhánh
    -- không tồn tại trong mô hình (admin_set_prospect_parent chặn chu trình và
    -- suy luận không chọn cha đang là chi nhánh).
    SELECT p_id AS unit_id, v_name AS unit_name
    UNION ALL
    SELECT o.id, o.name FROM public.asset_owners o
     WHERE p_kind = 'asset_owner' AND o.parent_owner_id = p_id
    UNION ALL
    SELECT a.id, a.name FROM public.auction_organizations a
     WHERE p_kind = 'auction_org' AND a.parent_org_id = p_id
  ),
  lrows AS (
    SELECT
      l.id AS listing_id, l.title, l.price, l.created_at,
      u.unit_id, u.unit_name,
      NULLIF(btrim(COALESCE(l.address->>'province', '')), '')  AS province,
      NULLIF(btrim(COALESCE(l.property_type_slug, '')), '')    AS slug,
      (SELECT pt.name FROM public.property_types pt WHERE pt.slug = l.property_type_slug) AS type_name,
      NULLIF(btrim(COALESCE(l.legal_status, '')), '')          AS legal_status,
      public.listing_auction_bucket(
        l.status::TEXT, COALESCE(l.custom_attributes, '{}'::JSONB),
        (SELECT count(*)::INT FROM public.listing_price_sessions s WHERE s.listing_id = l.id)
      ) AS bucket,
      (SELECT count(*)::INT FROM public.listing_price_sessions s WHERE s.listing_id = l.id) AS round_count,
      COALESCE(
        (l.custom_attributes->>'winning_price')::NUMERIC,
        (l.custom_attributes->>'win_price')::NUMERIC
      ) AS win_price,
      COALESCE(l.custom_attributes->>'auction_date', l.custom_attributes->>'auction_time') AS auction_at,
      CASE WHEN p_kind = 'asset_owner' THEN l.auction_org_id ELSE l.asset_owner_id END AS cp_id,
      CASE WHEN p_kind = 'asset_owner'
           THEN (SELECT a.name FROM public.auction_organizations a WHERE a.id = l.auction_org_id)
           ELSE (SELECT o.name FROM public.asset_owners o          WHERE o.id = l.asset_owner_id)
      END AS cp_name
    FROM units u
    JOIN public.listings l
      ON (p_kind = 'asset_owner' AND l.asset_owner_id = u.unit_id)
      OR (p_kind = 'auction_org' AND l.auction_org_id  = u.unit_id)
  ),
  posts AS (
    SELECT ap.* FROM public.asset_postings ap
    WHERE (p_kind = 'auction_org' AND ap.chosen_org_id = p_id)
       OR (p_kind = 'asset_owner' AND ap.user_id IN (
             SELECT w.owner_user_id FROM public.asset_owner_workspaces w
             JOIN public.asset_owner_claims c ON c.workspace_id = w.id
             WHERE c.asset_owner_id = p_id AND c.status IN ('auto_claimed','confirmed')))
  ),
  d_history AS (
    SELECT jsonb_agg(jsonb_build_object(
             'id', listing_id, 'title', title, 'price', price, 'province', province,
             'asset_type', COALESCE(type_name, slug), 'legal_status', legal_status,
             'bucket', bucket, 'round_count', round_count, 'win_price', win_price,
             'auction_at', auction_at, 'created_at', created_at,
             'counterparty_id', cp_id, 'counterparty', cp_name,
             'unit_id', unit_id, 'unit_name', unit_name
           ) ORDER BY COALESCE(auction_at, created_at::TEXT) DESC) AS j
    FROM (SELECT * FROM lrows ORDER BY COALESCE(auction_at, created_at::TEXT) DESC LIMIT 1000) t
  ),
  branch_rows AS (
    SELECT o.id AS b_id, 'asset_owner'::TEXT AS b_kind, o.name AS b_name,
           COALESCE(o.owner_kind, 'other') AS b_subtype,
           COALESCE(o.parent_source, 'inferred') AS b_relation,
           NULL::TEXT AS b_province
    FROM public.asset_owners o
    WHERE p_kind = 'asset_owner' AND o.parent_owner_id = p_id
    UNION ALL
    SELECT a.id, 'auction_org'::TEXT, a.name,
           CASE a.org_type
             WHEN 0  THEN 'center'
             WHEN 1  THEN 'enterprise'
             WHEN 2  THEN 'company'
             WHEN 11 THEN 'branch'
             ELSE 'other'
           END,
           COALESCE(a.parent_source, 'inferred'),
           a.province
    FROM public.auction_organizations a
    WHERE p_kind = 'auction_org' AND a.parent_org_id = p_id
  ),
  branch_agg AS (
    SELECT b.*,
      (SELECT count(*) FROM public.listings l2
        WHERE (b.b_kind = 'asset_owner' AND l2.asset_owner_id = b.b_id)
           OR (b.b_kind = 'auction_org' AND l2.auction_org_id  = b.b_id)) AS n_listings,
      (SELECT COALESCE(sum(l2.price), 0) FROM public.listings l2
        WHERE (b.b_kind = 'asset_owner' AND l2.asset_owner_id = b.b_id)
           OR (b.b_kind = 'auction_org' AND l2.auction_org_id  = b.b_id)) AS sum_price,
      COALESCE(b.b_province, (
        SELECT NULLIF(btrim(COALESCE(l3.address->>'province', '')), '')
        FROM public.listings l3
        WHERE l3.asset_owner_id = b.b_id
          AND NULLIF(btrim(COALESCE(l3.address->>'province', '')), '') IS NOT NULL
        GROUP BY 1 ORDER BY count(*) DESC LIMIT 1
      )) AS prov
    FROM branch_rows b
  ),
  d_branch AS (
    SELECT jsonb_agg(jsonb_build_object(
             'id', b_id, 'kind', b_kind, 'name', b_name, 'subtype', b_subtype,
             'province', prov, 'listing_count', n_listings,
             'starting_price_sum', sum_price, 'relation', b_relation,
             'is_amc', (b_subtype = 'amc' OR public.org_branch_marker(b_name) = 'amc')
           ) ORDER BY n_listings DESC, b_name) AS j
    FROM branch_agg
  )
  SELECT jsonb_build_object(
    'profile', jsonb_build_object(
      'id', p_id, 'kind', p_kind, 'name', v_name,
      'address', v_addr, 'aliases', to_jsonb(v_aliases),
      'entity_type', v_entity, 'subtype', v_subtype, 'parent', v_parent
    ),
    'postings_count', (SELECT count(*) FROM posts),
    'legal_flags', (
      SELECT jsonb_build_object(
        'total',        count(*),
        'has_dispute',  count(*) FILTER (WHERE has_dispute),
        'has_mortgage', count(*) FILTER (WHERE has_mortgage),
        'is_seized',    count(*) FILTER (WHERE is_seized),
        'clean',        count(*) FILTER (WHERE NOT COALESCE(has_dispute, false)
                                           AND NOT COALESCE(has_mortgage, false)
                                           AND NOT COALESCE(is_seized, false))
      ) FROM posts
    ),
    'branches', COALESCE((SELECT j FROM d_branch),  '[]'::JSONB),
    'history',  COALESCE((SELECT j FROM d_history), '[]'::JSONB)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_prospect_detail(TEXT, UUID) TO authenticated;
