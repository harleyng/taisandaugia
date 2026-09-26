-- Trạm Điều Hành — Phase 13: chi nhánh tự onboard (KYC rút gọn)
-- docs/owner-control-tower-plan.md §Phase 13 + quyết định D3.
--
-- Spike (dữ liệu thật 2026-09-26): chi nhánh làm KYC tổ chức như hiện nay thì
-- run_workspace_match khớp mờ theo tên ⇒ kéo luôn tài sản của công ty mẹ (tên mẹ
-- là chuỗi con của tên chi nhánh ⇒ 0.85) và của chi nhánh anh em (lọt vào
-- branch_names qua suggest_org_aliases). Phase này gắn không gian của chi nhánh
-- vào ĐÚNG MỘT thực thể asset_owners, không khớp theo tên nữa.
--
-- D3: chi nhánh chỉ bắt buộc email công vụ + giấy giao việc / uỷ quyền của Giám
-- đốc chi nhánh (authorization_doc_url) + thông tin & 2 ảnh giấy tờ của cán bộ.
-- Không bắt buộc quyết định thành lập, selfie, MST chi nhánh — phần đó do FE
-- kiểm; server chỉ ép những gì quyết định phạm vi dữ liệu.

-- ─── 1. Cột mới ─────────────────────────────────────────────────────────────

ALTER TABLE public.asset_owner_org_kyc
  ADD COLUMN IF NOT EXISTS kyc_scope TEXT NOT NULL DEFAULT 'organization',
  ADD COLUMN IF NOT EXISTS parent_asset_owner_id UUID
    REFERENCES public.asset_owners(id) ON DELETE SET NULL;

ALTER TABLE public.asset_owner_org_kyc
  DROP CONSTRAINT IF EXISTS asset_owner_org_kyc_kyc_scope_check,
  ADD CONSTRAINT asset_owner_org_kyc_kyc_scope_check
    CHECK (kyc_scope IN ('organization', 'branch')),
  DROP CONSTRAINT IF EXISTS asset_owner_org_kyc_parent_only_branch,
  ADD CONSTRAINT asset_owner_org_kyc_parent_only_branch
    CHECK (kyc_scope = 'branch' OR parent_asset_owner_id IS NULL);

COMMENT ON COLUMN public.asset_owner_org_kyc.kyc_scope IS
  'organization = KYC tổ chức đầy đủ (khớp tài sản theo tên); branch = chi nhánh, KYC rút gọn, không gian chỉ chứa tài sản của đúng thực thể chi nhánh';
COMMENT ON COLUMN public.asset_owner_org_kyc.parent_asset_owner_id IS
  'Công ty mẹ người khai chọn (chỉ với kyc_scope = branch). Chi nhánh chưa có trong danh bạ được tạo dưới công ty mẹ này khi duyệt';

-- Không gian đứng tên thực thể nào (HQ hay chi nhánh). NULL = tên tự nhập tay.
ALTER TABLE public.asset_owner_workspaces
  ADD COLUMN IF NOT EXISTS asset_owner_id UUID
    REFERENCES public.asset_owners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_scope TEXT NOT NULL DEFAULT 'names';

ALTER TABLE public.asset_owner_workspaces
  DROP CONSTRAINT IF EXISTS asset_owner_workspaces_match_scope_check,
  ADD CONSTRAINT asset_owner_workspaces_match_scope_check
    CHECK (match_scope IN ('names', 'entity'));

COMMENT ON COLUMN public.asset_owner_workspaces.asset_owner_id IS
  'Thực thể asset_owners mà không gian đại diện (từ linked_asset_owner_id của KYC). NULL = tên tự nhập';
COMMENT ON COLUMN public.asset_owner_workspaces.match_scope IS
  'names = khớp mờ theo primary_name/abbreviations/branch_names; entity = chỉ tài sản của asset_owner_id (không gian chi nhánh)';

-- Mỗi chi nhánh tối đa MỘT Trạm Điều Hành. Cán bộ thứ hai phải được mời vào.
CREATE UNIQUE INDEX IF NOT EXISTS asset_owner_workspaces_entity_uq
  ON public.asset_owner_workspaces (asset_owner_id)
  WHERE match_scope = 'entity';

-- Backfill: hiện chưa hồ sơ nào gắn danh bạ, nhưng giữ cho đúng nghĩa cột.
UPDATE public.asset_owner_workspaces w
   SET asset_owner_id = k.linked_asset_owner_id
  FROM public.asset_owner_org_kyc k
 WHERE k.id = w.org_kyc_id
   AND w.asset_owner_id IS NULL
   AND k.linked_asset_owner_id IS NOT NULL;

-- Claim sinh ra từ liên kết thực thể — không phải khớp tên.
ALTER TABLE public.asset_owner_claims
  DROP CONSTRAINT IF EXISTS asset_owner_claims_match_basis_check,
  ADD CONSTRAINT asset_owner_claims_match_basis_check
    CHECK (match_basis IN ('auto_name', 'manual_search', 'admin_assigned', 'linked_entity'));

-- ─── 2. Tìm thực thể chi nhánh của một hồ sơ ───────────────────────────────
-- Đã chọn trong danh bạ ⇒ chính nó. Tự nhập ⇒ dòng trùng tên chuẩn hoá (nếu
-- danh bạ đã có sẵn dưới một cách viết khác). Không có ⇒ NULL (tạo khi duyệt).

CREATE OR REPLACE FUNCTION public.owner_branch_find_entity(p_linked UUID, p_name TEXT)
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    p_linked,
    (SELECT o.id
       FROM public.asset_owners o
      WHERE COALESCE(btrim(p_name), '') <> ''
        AND o.normalized_name = public.normalize_org_name(btrim(p_name))
      ORDER BY (o.name = btrim(p_name)) DESC, o.created_at
      LIMIT 1)
  )
$$;

REVOKE ALL ON FUNCTION public.owner_branch_find_entity(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- ─── 3. Chặn nộp hồ sơ chi nhánh sai phạm vi ───────────────────────────────
-- Chạy khi hồ sơ CHUYỂN SANG pending_review (kể cả INSERT thẳng trạng thái đó —
-- policy own_rows cho phép). Hồ sơ tổ chức giữ nguyên hành vi cũ.

CREATE OR REPLACE FUNCTION public.asset_owner_org_kyc_branch_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent  public.asset_owners%ROWTYPE;
  v_entity  UUID;
  v_ent_par UUID;
BEGIN
  IF NEW.kyc_scope <> 'branch' OR NEW.status <> 'pending_review' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending_review' THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_asset_owner_id IS NULL THEN
    RAISE EXCEPTION 'branch_parent_required';
  END IF;
  SELECT * INTO v_parent FROM public.asset_owners WHERE id = NEW.parent_asset_owner_id;
  IF v_parent.id IS NULL THEN
    RAISE EXCEPTION 'branch_parent_required';
  END IF;

  IF NEW.linked_asset_owner_id IS NULL THEN
    IF length(COALESCE(btrim(NEW.org_name), '')) < 3
       OR public.normalize_org_name(btrim(NEW.org_name)) = v_parent.normalized_name THEN
      RAISE EXCEPTION 'branch_name_invalid';
    END IF;
  END IF;

  v_entity := public.owner_branch_find_entity(NEW.linked_asset_owner_id, NEW.org_name);
  IF v_entity IS NOT NULL THEN
    IF v_entity = v_parent.id THEN
      RAISE EXCEPTION 'branch_parent_mismatch';
    END IF;
    SELECT parent_owner_id INTO v_ent_par FROM public.asset_owners WHERE id = v_entity;
    IF v_ent_par IS NOT NULL AND v_ent_par <> v_parent.id THEN
      RAISE EXCEPTION 'branch_parent_mismatch';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.asset_owner_workspaces w
       WHERE w.asset_owner_id = v_entity
         AND w.match_scope = 'entity'
         AND w.org_kyc_id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'branch_workspace_exists';
    END IF;
  END IF;

  IF COALESCE(btrim(NEW.authorization_doc_url), '') = '' THEN
    RAISE EXCEPTION 'branch_authorization_required';
  END IF;
  IF COALESCE(NEW.official_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'branch_email_required';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.asset_owner_org_kyc_branch_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS asset_owner_org_kyc_branch_guard ON public.asset_owner_org_kyc;
CREATE TRIGGER asset_owner_org_kyc_branch_guard
  BEFORE INSERT OR UPDATE ON public.asset_owner_org_kyc
  FOR EACH ROW EXECUTE FUNCTION public.asset_owner_org_kyc_branch_guard();

-- ─── 4. Duyệt KYC ⇒ tạo không gian ─────────────────────────────────────────
-- Nhánh tổ chức: giữ nguyên bản 20260805000001, chỉ thêm asset_owner_id.
-- Nhánh chi nhánh: chốt thực thể (tạo trong danh bạ nếu chưa có), xác nhận
-- quan hệ mẹ–con (admin đã soát giấy uỷ quyền), không gian match_scope='entity'
-- không seed tên, một dòng workspace_branches cho chính chi nhánh.

CREATE OR REPLACE FUNCTION public.create_workspace_on_org_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws_id      UUID;
  v_suggestion JSONB;
  v_branches   TEXT[];
  v_entity     public.asset_owners%ROWTYPE;
  v_entity_id  UUID;
  v_kind       TEXT;
BEGIN
  IF NOT (NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved') THEN
    RETURN NEW;
  END IF;

  IF NEW.kyc_scope = 'branch' THEN
    IF NEW.parent_asset_owner_id IS NULL THEN
      RAISE EXCEPTION 'branch_parent_required';
    END IF;

    v_entity_id := public.owner_branch_find_entity(NEW.linked_asset_owner_id, NEW.org_name);

    IF v_entity_id IS NULL THEN
      IF length(COALESCE(btrim(NEW.org_name), '')) < 3 THEN
        RAISE EXCEPTION 'branch_name_invalid';
      END IF;
      v_kind := CASE NEW.org_type
                  WHEN 'bank_credit'  THEN 'bank_credit'
                  WHEN 'amc'          THEN 'amc'
                  WHEN 'enforcement'  THEN 'enforcement'
                  WHEN 'state_agency' THEN 'state_agency'
                  ELSE 'other'
                END;
      INSERT INTO public.asset_owners (name, owner_kind, parent_owner_id, parent_source)
      VALUES (btrim(NEW.org_name), v_kind, NEW.parent_asset_owner_id, 'confirmed')
      ON CONFLICT (name) DO NOTHING
      RETURNING id INTO v_entity_id;
      IF v_entity_id IS NULL THEN
        SELECT id INTO v_entity_id FROM public.asset_owners WHERE name = btrim(NEW.org_name);
      END IF;
    END IF;

    SELECT * INTO v_entity FROM public.asset_owners WHERE id = v_entity_id;
    IF v_entity.id = NEW.parent_asset_owner_id THEN
      RAISE EXCEPTION 'branch_parent_mismatch';
    END IF;
    IF v_entity.parent_owner_id IS NULL THEN
      UPDATE public.asset_owners
         SET parent_owner_id = NEW.parent_asset_owner_id, parent_source = 'confirmed'
       WHERE id = v_entity.id;
    ELSIF v_entity.parent_owner_id <> NEW.parent_asset_owner_id THEN
      RAISE EXCEPTION 'branch_parent_mismatch';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.asset_owner_workspaces w
       WHERE w.asset_owner_id = v_entity.id
         AND w.match_scope = 'entity'
         AND w.org_kyc_id <> NEW.id
    ) THEN
      RAISE EXCEPTION 'branch_workspace_exists';
    END IF;

    -- AFTER UPDATE OF status ⇒ ghi lại cột này không kích hoạt lại trigger duyệt.
    IF NEW.linked_asset_owner_id IS DISTINCT FROM v_entity.id THEN
      UPDATE public.asset_owner_org_kyc
         SET linked_asset_owner_id = v_entity.id
       WHERE id = NEW.id;
    END IF;

    INSERT INTO public.asset_owner_workspaces
      (org_kyc_id, owner_user_id, primary_name, abbreviations, branch_names,
       asset_owner_id, match_scope)
    VALUES (NEW.id, NEW.created_by, v_entity.name, '{}'::TEXT[], '{}'::TEXT[],
            v_entity.id, 'entity')
    ON CONFLICT (org_kyc_id) DO UPDATE
      SET abbreviations  = '{}'::TEXT[],
          branch_names   = '{}'::TEXT[],
          asset_owner_id = EXCLUDED.asset_owner_id,
          match_scope    = 'entity'
    RETURNING id INTO v_ws_id;

    INSERT INTO public.workspace_branches (workspace_id, asset_owner_id, display_name, is_amc)
    VALUES (v_ws_id, v_entity.id, v_entity.name, COALESCE(v_entity.owner_kind = 'amc', false))
    ON CONFLICT (workspace_id, asset_owner_id) DO NOTHING;

    PERFORM public.run_workspace_match(v_ws_id);
    RETURN NEW;
  END IF;

  v_suggestion := public.suggest_org_aliases(COALESCE(NEW.org_name, ''));
  v_branches := COALESCE((
    SELECT array_agg(c->>'name')
    FROM jsonb_array_elements(v_suggestion->'candidates') AS c
  ), '{}'::TEXT[]);

  INSERT INTO public.asset_owner_workspaces
    (org_kyc_id, owner_user_id, primary_name, abbreviations, branch_names, asset_owner_id)
  VALUES (
    NEW.id, NEW.created_by, COALESCE(NEW.org_name, ''),
    COALESCE(NEW.aliases, '{}'::TEXT[]),
    v_branches,
    NEW.linked_asset_owner_id
  )
  ON CONFLICT (org_kyc_id) DO UPDATE
    SET abbreviations  = EXCLUDED.abbreviations,
        branch_names   = EXCLUDED.branch_names,
        asset_owner_id = EXCLUDED.asset_owner_id,
        match_scope    = 'names'
  RETURNING id INTO v_ws_id;

  IF v_ws_id IS NOT NULL THEN
    -- Khớp ngay để user đăng nhập lại là đã thấy tài sản, không phải claim tay
    PERFORM public.run_workspace_match(v_ws_id);
  END IF;
  RETURN NEW;
END;
$$;

-- ─── 5. run_workspace_match: nhánh thực thể ────────────────────────────────
-- Thân nhánh 'names' giữ nguyên bản 20260926140447. Nhánh 'entity' bỏ qua mọi
-- seed tên — chỉ tin đứng tên đúng asset_owner_id của không gian.

CREATE OR REPLACE FUNCTION public.run_workspace_match(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws       public.asset_owner_workspaces%ROWTYPE;
  v_seeds    TEXT[];
  v_inserted INT := 0;
  v_auto     INT := 0;
  v_pending  INT := 0;
BEGIN
  SELECT * INTO v_ws FROM public.asset_owner_workspaces WHERE id = p_workspace_id;
  IF v_ws.id IS NULL THEN
    RAISE EXCEPTION 'workspace_not_found';
  END IF;

  -- Trưởng đơn vị, admin, hoặc service_role / trigger (auth.uid() IS NULL)
  IF auth.uid() IS NOT NULL
     AND NOT public.owner_ws_can(p_workspace_id, 'manage_workspace')
     AND NOT public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_ws.match_scope = 'entity' THEN
    IF v_ws.asset_owner_id IS NOT NULL THEN
      WITH ins AS (
        INSERT INTO public.asset_owner_claims
          (workspace_id, listing_id, asset_owner_id, confidence_score, match_basis, matched_name, status)
        SELECT p_workspace_id, l.id, o.id, 1.0, 'linked_entity', o.name, 'auto_claimed'
        FROM public.listings l
        JOIN public.asset_owners o ON o.id = l.asset_owner_id
        WHERE l.asset_owner_id = v_ws.asset_owner_id
        ON CONFLICT (workspace_id, listing_id) DO NOTHING
        RETURNING status
      )
      SELECT count(*)::INT, count(*)::INT INTO v_inserted, v_auto FROM ins;
    END IF;
  ELSE
    v_seeds := ARRAY(
      SELECT DISTINCT s FROM unnest(
        ARRAY[v_ws.primary_name] || v_ws.abbreviations || v_ws.branch_names
      ) AS s WHERE COALESCE(btrim(s), '') <> ''
    );

    IF COALESCE(array_length(v_seeds, 1), 0) = 0 THEN
      RETURN jsonb_build_object('inserted', 0, 'auto_claimed', 0, 'pending', 0);
    END IF;

    WITH scored AS (
      SELECT o.id AS owner_id, o.name AS owner_name,
             (SELECT max(public.org_name_similarity(o.name, s)) FROM unnest(v_seeds) AS s) AS score
      FROM public.asset_owners o
    ),
    hits AS (SELECT * FROM scored WHERE score >= 0.6),
    ins AS (
      INSERT INTO public.asset_owner_claims
        (workspace_id, listing_id, asset_owner_id, confidence_score, match_basis, matched_name, status)
      SELECT p_workspace_id, l.id, h.owner_id, h.score, 'auto_name', h.owner_name,
             CASE WHEN h.score >= 0.9 THEN 'auto_claimed' ELSE 'pending_confirmation' END
      FROM hits h
      JOIN public.listings l ON l.asset_owner_id = h.owner_id
      ON CONFLICT (workspace_id, listing_id) DO NOTHING
      RETURNING status
    )
    SELECT count(*)::INT,
           count(*) FILTER (WHERE status = 'auto_claimed')::INT,
           count(*) FILTER (WHERE status = 'pending_confirmation')::INT
      INTO v_inserted, v_auto, v_pending
    FROM ins;
  END IF;

  UPDATE public.asset_owner_workspaces
     SET last_matched_at = now(),
         total_claimed = (
           SELECT count(*) FROM public.asset_owner_claims
           WHERE workspace_id = p_workspace_id AND status IN ('auto_claimed','confirmed')
         )
   WHERE id = p_workspace_id;

  RETURN jsonb_build_object('inserted', v_inserted, 'auto_claimed', v_auto, 'pending', v_pending);
END;
$$;

REVOKE ALL ON FUNCTION public.run_workspace_match(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_workspace_match(UUID) TO authenticated, service_role;

-- ─── 6. Claim tay trong không gian chi nhánh ───────────────────────────────
-- Chỉ nhận tin đứng tên chính chi nhánh, hoặc công ty mẹ (tin cào thường ghi
-- tên trụ sở dù chi nhánh xử lý), hoặc chưa rõ chủ. Chi nhánh anh em / đơn vị
-- khác ⇒ claim_outside_branch. Chủ của claim do SERVER quyết (lấy từ tin).
-- Admin và service_role / trigger (auth.uid() IS NULL) không bị chặn.

CREATE OR REPLACE FUNCTION public.owner_ws_claims_entity_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope  TEXT;
  v_entity UUID;
  v_parent UUID;
  v_owner  UUID;
BEGIN
  SELECT match_scope, asset_owner_id INTO v_scope, v_entity
    FROM public.asset_owner_workspaces WHERE id = NEW.workspace_id;
  IF v_scope IS DISTINCT FROM 'entity' THEN
    RETURN NEW;
  END IF;

  IF NEW.listing_id IS NOT NULL THEN
    SELECT asset_owner_id INTO v_owner FROM public.listings WHERE id = NEW.listing_id;
    NEW.asset_owner_id := v_owner;
  ELSE
    v_owner := NEW.asset_owner_id;
  END IF;

  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'ADMIN'::app_role) THEN
    RETURN NEW;
  END IF;

  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT parent_owner_id INTO v_parent FROM public.asset_owners WHERE id = v_entity;
  IF v_owner = v_entity OR v_owner = v_parent THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'claim_outside_branch';
END;
$$;

REVOKE ALL ON FUNCTION public.owner_ws_claims_entity_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS asset_owner_claims_entity_guard ON public.asset_owner_claims;
CREATE TRIGGER asset_owner_claims_entity_guard
  BEFORE INSERT OR UPDATE OF listing_id, asset_owner_id ON public.asset_owner_claims
  FOR EACH ROW EXECUTE FUNCTION public.owner_ws_claims_entity_guard();

-- ─── 7. Tự kiểm ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'asset_owner_org_kyc_approve'
       AND tgrelid = 'public.asset_owner_org_kyc'::regclass
  ) THEN
    RAISE EXCEPTION 'self-check: thiếu trigger duyệt KYC tổ chức';
  END IF;
  -- Khách vẫn không được sửa cột phạm vi của không gian (chỉ 3 cột seed).
  IF has_column_privilege('authenticated', 'public.asset_owner_workspaces', 'match_scope', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.asset_owner_workspaces', 'asset_owner_id', 'UPDATE') THEN
    RAISE EXCEPTION 'self-check: authenticated không được UPDATE match_scope / asset_owner_id';
  END IF;
END $$;
