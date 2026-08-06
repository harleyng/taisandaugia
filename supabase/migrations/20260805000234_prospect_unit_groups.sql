-- Cụm đơn vị (VD "Cụm miền Bắc" / "Cụm miền Nam") + thao tác hàng loạt.
--
-- Trước đó chỉ có MỘT cấp quan hệ mẹ → chi nhánh và gán/gỡ từng cái một. Ngân
-- hàng vài chục chi nhánh thì danh sách phẳng không đọc được, và admin phải bấm
-- từng dòng để sắp lại. Cụm là tầng trung gian do người tự đặt tên, thuộc về một
-- công ty mẹ cụ thể.
--
-- 1. Bảng prospect_unit_groups + cột group_id trên hai bảng pháp nhân
-- 2. admin_prospect_groups_* — CRUD cụm
-- 3. admin_set_prospect_group  — gán/gỡ cụm hàng loạt
-- 4. admin_set_prospect_parents— gán/gỡ công ty mẹ hàng loạt
-- 5. admin_prospect_detail     — trả groups, và gắn cụm vào từng chi nhánh + từng tin

-- ─── 1. Bảng cụm ─────────────────────────────────────────────────────────────

-- parent_id CỐ Ý không có FK: nó trỏ vào asset_owners HOẶC auction_organizations
-- tuỳ `kind`, Postgres không có FK đa đích. Ràng buộc được ép ở RPC (mọi lối ghi
-- đều đi qua SECURITY DEFINER), và ON DELETE của pháp nhân mẹ không tồn tại vì
-- hai bảng đó không bao giờ bị xoá cứng.
CREATE TABLE IF NOT EXISTS public.prospect_unit_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       TEXT NOT NULL CHECK (kind IN ('asset_owner','auction_org')),
  parent_id  UUID NOT NULL,
  name       TEXT NOT NULL,
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kind, parent_id, name)
);

CREATE INDEX IF NOT EXISTS idx_prospect_groups_parent
  ON public.prospect_unit_groups(kind, parent_id);

ALTER TABLE public.prospect_unit_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospect_groups_admin" ON public.prospect_unit_groups;
CREATE POLICY "prospect_groups_admin"
  ON public.prospect_unit_groups FOR ALL
  USING (public.has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::app_role));

DROP TRIGGER IF EXISTS prospect_unit_groups_updated_at ON public.prospect_unit_groups;
CREATE TRIGGER prospect_unit_groups_updated_at
  BEFORE UPDATE ON public.prospect_unit_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Xoá cụm thì thành viên rơi về "chưa xếp cụm", không mất quan hệ với công ty mẹ.
ALTER TABLE public.asset_owners
  ADD COLUMN IF NOT EXISTS group_id UUID
    REFERENCES public.prospect_unit_groups(id) ON DELETE SET NULL;

ALTER TABLE public.auction_organizations
  ADD COLUMN IF NOT EXISTS group_id UUID
    REFERENCES public.prospect_unit_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_asset_owners_group  ON public.asset_owners(group_id);
CREATE INDEX IF NOT EXISTS idx_auction_orgs_group  ON public.auction_organizations(group_id);

-- ─── 2. CRUD cụm ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_upsert_prospect_group(
  p_kind       TEXT,
  p_parent_id  UUID,
  p_name       TEXT,
  p_group_id   UUID DEFAULT NULL,
  p_sort_order INT  DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id   UUID;
  v_name TEXT := btrim(COALESCE(p_name, ''));
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_kind NOT IN ('asset_owner', 'auction_org') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'empty_name';
  END IF;

  IF p_group_id IS NOT NULL THEN
    UPDATE public.prospect_unit_groups
       SET name       = v_name,
           sort_order = COALESCE(p_sort_order, sort_order)
     WHERE id = p_group_id AND kind = p_kind AND parent_id = p_parent_id
     RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'group_not_found';
    END IF;
  ELSE
    INSERT INTO public.prospect_unit_groups (kind, parent_id, name, sort_order)
    VALUES (p_kind, p_parent_id, v_name,
            COALESCE(p_sort_order,
              (SELECT COALESCE(max(sort_order), 0) + 1
                 FROM public.prospect_unit_groups
                WHERE kind = p_kind AND parent_id = p_parent_id)))
    RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('id', v_id, 'name', v_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_prospect_group(TEXT, UUID, TEXT, UUID, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_prospect_group(p_group_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Thành viên rơi về "chưa xếp cụm" nhờ ON DELETE SET NULL — quan hệ với công
  -- ty mẹ giữ nguyên, xoá cụm KHÔNG làm mất chi nhánh.
  DELETE FROM public.prospect_unit_groups WHERE id = p_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'group_not_found';
  END IF;

  RETURN jsonb_build_object('ok', true, 'group_id', p_group_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_prospect_group(UUID) TO authenticated;

-- ─── 3. Gán / gỡ cụm hàng loạt ───────────────────────────────────────────────

-- p_group_id NULL = gỡ khỏi cụm. Chỉ gán được đơn vị ĐANG trực thuộc đúng công
-- ty mẹ của cụm — cụm là tài sản của một cụm doanh nghiệp, không phải nhãn tự do.
CREATE OR REPLACE FUNCTION public.admin_set_prospect_group(
  p_kind     TEXT,
  p_unit_ids UUID[],
  p_group_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent UUID;
  v_n      INT := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_kind NOT IN ('asset_owner', 'auction_org') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;
  IF p_unit_ids IS NULL OR array_length(p_unit_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'no_units';
  END IF;

  IF p_group_id IS NOT NULL THEN
    SELECT parent_id INTO v_parent
      FROM public.prospect_unit_groups
     WHERE id = p_group_id AND kind = p_kind;
    IF v_parent IS NULL THEN
      RAISE EXCEPTION 'group_not_found';
    END IF;
  END IF;

  IF p_kind = 'asset_owner' THEN
    UPDATE public.asset_owners
       SET group_id = p_group_id
     WHERE id = ANY(p_unit_ids)
       AND (p_group_id IS NULL OR parent_owner_id = v_parent);
  ELSE
    UPDATE public.auction_organizations
       SET group_id = p_group_id
     WHERE id = ANY(p_unit_ids)
       AND (p_group_id IS NULL OR parent_org_id = v_parent);
  END IF;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n = 0 THEN
    RAISE EXCEPTION 'no_eligible_units';
  END IF;

  RETURN jsonb_build_object('ok', true, 'updated', v_n, 'group_id', p_group_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_prospect_group(TEXT, UUID[], UUID) TO authenticated;

-- ─── 4. Gán / gỡ công ty mẹ hàng loạt ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_set_prospect_parents(
  p_kind      TEXT,
  p_child_ids UUID[],
  p_parent_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grand UUID;
  v_n     INT := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_kind NOT IN ('asset_owner', 'auction_org') THEN
    RAISE EXCEPTION 'invalid_kind';
  END IF;
  IF p_child_ids IS NULL OR array_length(p_child_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'no_units';
  END IF;
  IF p_parent_id = ANY(p_child_ids) THEN
    RAISE EXCEPTION 'self_parent';
  END IF;

  IF p_parent_id IS NOT NULL THEN
    IF p_kind = 'asset_owner' THEN
      SELECT parent_owner_id INTO v_grand FROM public.asset_owners WHERE id = p_parent_id;
    ELSE
      SELECT parent_org_id  INTO v_grand FROM public.auction_organizations WHERE id = p_parent_id;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'parent_not_found'; END IF;
    IF v_grand = ANY(p_child_ids) THEN RAISE EXCEPTION 'cycle'; END IF;
  END IF;

  -- Rời công ty mẹ thì rời luôn cụm: cụm thuộc về một công ty mẹ cụ thể, giữ lại
  -- group_id sẽ thành thành viên "mồ côi" của cụm nhà người khác.
  IF p_kind = 'asset_owner' THEN
    UPDATE public.asset_owners
       SET parent_owner_id = p_parent_id,
           parent_source   = CASE WHEN p_parent_id IS NULL THEN NULL ELSE 'confirmed' END,
           group_id        = CASE WHEN p_parent_id IS NULL THEN NULL ELSE group_id END
     WHERE id = ANY(p_child_ids);
  ELSE
    UPDATE public.auction_organizations
       SET parent_org_id = p_parent_id,
           parent_source = CASE WHEN p_parent_id IS NULL THEN NULL ELSE 'confirmed' END,
           group_id      = CASE WHEN p_parent_id IS NULL THEN NULL ELSE group_id END
     WHERE id = ANY(p_child_ids);
  END IF;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n = 0 THEN
    RAISE EXCEPTION 'child_not_found';
  END IF;

  RETURN jsonb_build_object('ok', true, 'updated', v_n, 'parent_id', p_parent_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_prospect_parents(TEXT, UUID[], UUID) TO authenticated;

-- Bản đơn lẻ nay chỉ là vỏ bọc, để một chỗ duy nhất giữ luật gán cha.
CREATE OR REPLACE FUNCTION public.admin_set_prospect_parent(
  p_kind      TEXT,
  p_child_id  UUID,
  p_parent_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_child_id IS NULL THEN
    RAISE EXCEPTION 'missing_child';
  END IF;
  RETURN public.admin_set_prospect_parents(p_kind, ARRAY[p_child_id], p_parent_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_prospect_parent(TEXT, UUID, UUID) TO authenticated;

-- ─── 5. admin_prospect_detail: cụm vào chi nhánh + vào từng tin ──────────────

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
    -- Công ty mẹ KHÔNG thuộc cụm nào: cụm nằm dưới nó, không bao nó.
    SELECT p_id AS unit_id, v_name AS unit_name, NULL::UUID AS grp_id
    UNION ALL
    SELECT o.id, o.name, o.group_id FROM public.asset_owners o
     WHERE p_kind = 'asset_owner' AND o.parent_owner_id = p_id
    UNION ALL
    SELECT a.id, a.name, a.group_id FROM public.auction_organizations a
     WHERE p_kind = 'auction_org' AND a.parent_org_id = p_id
  ),
  lrows AS (
    SELECT
      l.id AS listing_id, l.title, l.price, l.created_at,
      u.unit_id, u.unit_name, u.grp_id,
      (SELECT g.name FROM public.prospect_unit_groups g WHERE g.id = u.grp_id) AS grp_name,
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
             'unit_id', unit_id, 'unit_name', unit_name,
             'group_id', grp_id, 'group_name', grp_name
           ) ORDER BY COALESCE(auction_at, created_at::TEXT) DESC) AS j
    FROM (SELECT * FROM lrows ORDER BY COALESCE(auction_at, created_at::TEXT) DESC LIMIT 1000) t
  ),
  branch_rows AS (
    SELECT o.id AS b_id, 'asset_owner'::TEXT AS b_kind, o.name AS b_name,
           COALESCE(o.owner_kind, 'other') AS b_subtype,
           COALESCE(o.parent_source, 'inferred') AS b_relation,
           NULL::TEXT AS b_province, o.group_id AS b_group
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
           a.province, a.group_id
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
      (SELECT g.name FROM public.prospect_unit_groups g WHERE g.id = b.b_group) AS grp_name,
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
             'is_amc', (b_subtype = 'amc' OR public.org_branch_marker(b_name) = 'amc'),
             'group_id', b_group, 'group_name', grp_name
           ) ORDER BY n_listings DESC, b_name) AS j
    FROM branch_agg
  ),
  d_group AS (
    SELECT jsonb_agg(jsonb_build_object(
             'id', g.id, 'name', g.name, 'sort_order', g.sort_order,
             'unit_count',    (SELECT count(*) FROM branch_agg b WHERE b.b_group = g.id),
             'listing_count', (SELECT count(*) FROM lrows  r WHERE r.grp_id  = g.id),
             'starting_price_sum',
               (SELECT COALESCE(sum(r.price), 0) FROM lrows r WHERE r.grp_id = g.id)
           ) ORDER BY g.sort_order, g.name) AS j
    FROM public.prospect_unit_groups g
    WHERE g.kind = p_kind AND g.parent_id = p_id
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
    'groups',   COALESCE((SELECT j FROM d_group),   '[]'::JSONB),
    'branches', COALESCE((SELECT j FROM d_branch),  '[]'::JSONB),
    'history',  COALESCE((SELECT j FROM d_history), '[]'::JSONB)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_prospect_detail(TEXT, UUID) TO authenticated;
