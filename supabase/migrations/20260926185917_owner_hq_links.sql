-- Liên kết trụ sở ↔ chi nhánh + so sánh ẩn danh + tín hiệu bán hàng — Phase 14 của
-- docs/owner-control-tower-plan.md.
--
-- 1. Cây MỘT cấp: asset_owner_workspaces.parent_workspace_id. Trụ sở (Trạm có pháp nhân
--    trong danh bạ) GỬI yêu cầu liên kết tới Trạm của đơn vị con trong danh bạ
--    (asset_owners.parent_owner_id); Trưởng đơn vị chi nhánh ĐỒNG Ý / TỪ CHỐI. Chưa đồng
--    ý ⇒ trụ sở không thấy gì. Liên kết giữ nguyên khi danh bạ đổi cha sau này (đã có
--    sự đồng ý) — một trong hai bên huỷ liên kết được bất cứ lúc nào.
-- 2. owner_ws_can(...,'read') mở cho Trưởng đơn vị (role 'owner') của Trạm cha. Chỉ
--    'read' — mọi quyền ghi / quản lý / chốt báo cáo vẫn chỉ thành viên trực tiếp.
--    Danh sách thành viên chi nhánh KHÔNG mở cho trụ sở (người dùng chốt 2026-09-26).
-- 3. owner_ws_benchmark: so sánh ẩn danh với các Trạm cùng công ty mẹ. Dưới 3 chi nhánh
--    có số liệu ⇒ ẩn; 3–4 ⇒ chỉ "tốt hơn / kém hơn trung vị" (3 giá trị + tứ phân vị
--    là giải ngược được số của từng chi nhánh); từ 5 mới trả tứ phân vị (đã làm tròn).
-- 4. Tín hiệu bán hàng: ≥ 3 Trạm con cùng công ty mẹ, hoặc một link báo cáo được mở
--    ≥ 10 lần ⇒ MỘT lead source='owner_hq_expansion' cho công ty mẹ (unique theo
--    prospect_id — không bao giờ trùng, kể cả khi đã có lead 'market_data').

LOCK TABLE public.asset_owner_workspaces, public.asset_owner_workspace_members,
           public.asset_owners, public.leads IN ACCESS EXCLUSIVE MODE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Cây trụ sở → chi nhánh
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.asset_owner_workspaces
  ADD COLUMN parent_workspace_id UUID REFERENCES public.asset_owner_workspaces(id) ON DELETE SET NULL,
  ADD COLUMN parent_linked_at    TIMESTAMPTZ,
  ADD CONSTRAINT aow_parent_not_self CHECK (parent_workspace_id IS DISTINCT FROM id);

CREATE INDEX asset_owner_workspaces_parent_idx
  ON public.asset_owner_workspaces (parent_workspace_id)
  WHERE parent_workspace_id IS NOT NULL;

-- Hai cột mới chỉ ghi qua RPC (bảng đã REVOKE UPDATE, chỉ GRANT 3 cột tên / alias).

-- Chốt chặn cuối: cây đúng MỘT cấp (RPC đã khoá advisory, trigger này bắt các đường khác).
CREATE OR REPLACE FUNCTION public.owner_ws_tree_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_workspace_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.asset_owner_workspaces p
                WHERE p.id = NEW.parent_workspace_id AND p.parent_workspace_id IS NOT NULL) THEN
      RAISE EXCEPTION 'owner_ws_tree_depth: trạm cha đang là trạm con của trạm khác'
        USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM public.asset_owner_workspaces c
                WHERE c.parent_workspace_id = NEW.id) THEN
      RAISE EXCEPTION 'owner_ws_tree_depth: trạm đang có trạm con, không thể làm trạm con'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER asset_owner_workspaces_tree_guard
  BEFORE INSERT OR UPDATE OF parent_workspace_id ON public.asset_owner_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.owner_ws_tree_guard();

REVOKE ALL ON FUNCTION public.owner_ws_tree_guard() FROM PUBLIC, anon, authenticated;

-- ─── Yêu cầu liên kết (lịch sử đầy đủ, không xoá) ──────────────────────────
CREATE TABLE public.owner_workspace_link_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_workspace_id UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  child_workspace_id  UUID NOT NULL REFERENCES public.asset_owner_workspaces(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'unlinked')),
  requested_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  responded_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ended_by            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at        TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT owlr_not_self CHECK (parent_workspace_id <> child_workspace_id)
);

CREATE UNIQUE INDEX owner_workspace_link_requests_pending_uq
  ON public.owner_workspace_link_requests (parent_workspace_id, child_workspace_id)
  WHERE status = 'pending';
CREATE INDEX owner_workspace_link_requests_child_idx
  ON public.owner_workspace_link_requests (child_workspace_id, status);

CREATE TRIGGER owner_workspace_link_requests_updated_at
  BEFORE UPDATE ON public.owner_workspace_link_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.owner_workspace_link_requests ENABLE ROW LEVEL SECURITY;

-- Thành viên TRỰC TIẾP của một trong hai bên (trụ sở đã liên kết không nhìn hộp thư
-- yêu cầu của chi nhánh với trụ sở khác).
CREATE POLICY owner_workspace_link_requests_read ON public.owner_workspace_link_requests
  FOR SELECT TO authenticated
  USING (public.owner_ws_role(parent_workspace_id) IS NOT NULL
         OR public.owner_ws_role(child_workspace_id) IS NOT NULL);

REVOKE ALL ON public.owner_workspace_link_requests FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.owner_workspace_link_requests FROM authenticated;
GRANT SELECT ON public.owner_workspace_link_requests TO authenticated;

-- ─── Điều kiện liên kết (dùng lúc gửi VÀ lúc đồng ý) ───────────────────────
-- NULL = hợp lệ; ngược lại là mã lý do.
CREATE OR REPLACE FUNCTION public.owner_ws_link_check(p_parent_ws UUID, p_child_ws UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.asset_owner_workspaces%ROWTYPE;
  c public.asset_owner_workspaces%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.asset_owner_workspaces WHERE id = p_parent_ws;
  SELECT * INTO c FROM public.asset_owner_workspaces WHERE id = p_child_ws;
  IF p.id IS NULL OR c.id IS NULL THEN
    RETURN 'link_not_found';
  END IF;
  IF p.id = c.id THEN
    RETURN 'link_self';
  END IF;
  -- Trụ sở phải gắn pháp nhân trong danh bạ và không tự là trạm con.
  IF p.asset_owner_id IS NULL OR p.parent_workspace_id IS NOT NULL THEN
    RETURN 'link_parent_not_eligible';
  END IF;
  -- Đơn vị con của pháp nhân trụ sở theo danh bạ (inferred hay confirmed đều được —
  -- chi nhánh vẫn phải tự đồng ý).
  IF c.asset_owner_id IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.asset_owners ao
        WHERE ao.id = c.asset_owner_id AND ao.parent_owner_id = p.asset_owner_id) THEN
    RETURN 'link_not_a_branch';
  END IF;
  IF c.parent_workspace_id IS NOT NULL THEN
    RETURN 'link_already_linked';
  END IF;
  IF EXISTS (SELECT 1 FROM public.asset_owner_workspaces g WHERE g.parent_workspace_id = c.id) THEN
    RETURN 'link_child_has_children';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_ws_link_check(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- ─── Tổng quan liên kết của một Trạm (thành viên trực tiếp) ─────────────────
CREATE OR REPLACE FUNCTION public.owner_ws_link_overview(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w          public.asset_owner_workspaces%ROWTYPE;
  v_entity   public.asset_owners%ROWTYPE;
  v_children JSONB;
BEGIN
  IF public.owner_ws_role(p_workspace_id) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'link_forbidden');
  END IF;

  SELECT * INTO w FROM public.asset_owner_workspaces WHERE id = p_workspace_id;
  SELECT * INTO v_entity FROM public.asset_owners WHERE id = w.asset_owner_id;

  -- Đơn vị con = các trạm đã liên kết (kể cả khi danh bạ đã đổi cha) + các đơn vị
  -- con trong danh bạ chưa liên kết với trạm này.
  SELECT COALESCE(jsonb_agg(x.obj ORDER BY x.sort_key, x.name), '[]'::jsonb)
    INTO v_children
    FROM (
      SELECT 0 AS sort_key, COALESCE(ce.name, cw.primary_name) AS name,
             jsonb_build_object(
               'asset_owner_id', cw.asset_owner_id,
               'name',           COALESCE(ce.name, cw.primary_name),
               'workspace_id',   cw.id,
               'workspace_name', cw.primary_name,
               'state',          'linked',
               'request_id',     NULL,
               'requested_at',   NULL,
               'linked_at',      cw.parent_linked_at) AS obj
        FROM public.asset_owner_workspaces cw
        LEFT JOIN public.asset_owners ce ON ce.id = cw.asset_owner_id
       WHERE cw.parent_workspace_id = w.id
      UNION ALL
      SELECT CASE WHEN cw.id IS NULL THEN 2 ELSE 1 END, c.name,
             jsonb_build_object(
               'asset_owner_id', c.id,
               'name',           c.name,
               'workspace_id',   cw.id,
               'workspace_name', cw.primary_name,
               'state', CASE
                 WHEN cw.id IS NULL                      THEN 'no_workspace'
                 WHEN cw.parent_workspace_id IS NOT NULL THEN 'linked_elsewhere'
                 WHEN pr.id IS NOT NULL                  THEN 'pending'
                 WHEN w.parent_workspace_id IS NOT NULL
                      OR EXISTS (SELECT 1 FROM public.asset_owner_workspaces g
                                  WHERE g.parent_workspace_id = cw.id) THEN 'ineligible'
                 ELSE 'available'
               END,
               'request_id',     pr.id,
               'requested_at',   pr.created_at,
               'linked_at',      NULL) AS obj
        FROM public.asset_owners c
        LEFT JOIN LATERAL (
          SELECT x.* FROM public.asset_owner_workspaces x
           WHERE x.asset_owner_id = c.id AND x.id <> w.id
           ORDER BY (x.match_scope = 'entity') DESC, x.created_at
           LIMIT 1
        ) cw ON true
        LEFT JOIN public.owner_workspace_link_requests pr
          ON pr.parent_workspace_id = w.id AND pr.child_workspace_id = cw.id AND pr.status = 'pending'
       WHERE w.asset_owner_id IS NOT NULL
         AND c.parent_owner_id = w.asset_owner_id
         AND NOT EXISTS (SELECT 1 FROM public.asset_owner_workspaces l
                          WHERE l.parent_workspace_id = w.id AND l.asset_owner_id = c.id)
    ) x;

  RETURN jsonb_build_object(
    'ok', true,
    'workspace_name', w.primary_name,
    'entity', CASE WHEN v_entity.id IS NULL THEN NULL ELSE jsonb_build_object(
      'name',        v_entity.name,
      'parent_name', (SELECT pa.name FROM public.asset_owners pa WHERE pa.id = v_entity.parent_owner_id)
    ) END,
    'parent', (
      SELECT jsonb_build_object(
               'workspace_name', p.primary_name,
               'entity_name',    pe.name,
               'linked_at',      w.parent_linked_at)
        FROM public.asset_owner_workspaces p
        LEFT JOIN public.asset_owners pe ON pe.id = p.asset_owner_id
       WHERE p.id = w.parent_workspace_id),
    'incoming', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'request_id',     r.id,
               'workspace_name', p.primary_name,
               'entity_name',    pe.name,
               'requested_at',   r.created_at) ORDER BY r.created_at)
        FROM public.owner_workspace_link_requests r
        JOIN public.asset_owner_workspaces p ON p.id = r.parent_workspace_id
        LEFT JOIN public.asset_owners pe     ON pe.id = p.asset_owner_id
       WHERE r.child_workspace_id = w.id AND r.status = 'pending'), '[]'::jsonb),
    'can_have_children', w.asset_owner_id IS NOT NULL AND w.parent_workspace_id IS NULL,
    'children', v_children
  );
END;
$$;

-- ─── Gửi / huỷ / trả lời / huỷ liên kết ────────────────────────────────────
-- Mọi RPC liên kết khoá chung một advisory lock ⇒ hai lượt đồng ý song song không tạo
-- được cây 2 cấp (trigger owner_ws_tree_guard là chốt chặn cuối).

CREATE OR REPLACE FUNCTION public.owner_ws_request_link(p_parent_ws UUID, p_child_ws UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reason TEXT;
  v_id     UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('owner_ws_link'));
  IF NOT public.owner_ws_can(p_parent_ws, 'manage_workspace') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'link_forbidden');
  END IF;

  v_reason := public.owner_ws_link_check(p_parent_ws, p_child_ws);
  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_reason);
  END IF;
  IF EXISTS (SELECT 1 FROM public.owner_workspace_link_requests r
              WHERE r.parent_workspace_id = p_parent_ws AND r.child_workspace_id = p_child_ws
                AND r.status = 'pending') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'link_already_pending');
  END IF;

  INSERT INTO public.owner_workspace_link_requests (parent_workspace_id, child_workspace_id, requested_by)
  VALUES (p_parent_ws, p_child_ws, auth.uid())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'request_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_ws_cancel_link_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.owner_workspace_link_requests%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('owner_ws_link'));
  SELECT * INTO r FROM public.owner_workspace_link_requests WHERE id = p_request_id;
  IF NOT FOUND OR NOT public.owner_ws_can(r.parent_workspace_id, 'manage_workspace') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'link_not_found');
  END IF;
  IF r.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'link_not_pending');
  END IF;

  UPDATE public.owner_workspace_link_requests
     SET status = 'cancelled', responded_by = auth.uid(), responded_at = now()
   WHERE id = r.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_ws_respond_link(p_request_id UUID, p_accept BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r        public.owner_workspace_link_requests%ROWTYPE;
  v_reason TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('owner_ws_link'));
  SELECT * INTO r FROM public.owner_workspace_link_requests WHERE id = p_request_id;
  IF NOT FOUND OR NOT public.owner_ws_can(r.child_workspace_id, 'manage_workspace') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'link_not_found');
  END IF;
  IF r.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'link_not_pending');
  END IF;

  IF NOT COALESCE(p_accept, false) THEN
    UPDATE public.owner_workspace_link_requests
       SET status = 'declined', responded_by = auth.uid(), responded_at = now()
     WHERE id = r.id;
    RETURN jsonb_build_object('ok', true, 'status', 'declined');
  END IF;

  -- Điều kiện có thể đã đổi từ lúc gửi (trạm đã liên kết nơi khác, danh bạ đổi cha…).
  v_reason := public.owner_ws_link_check(r.parent_workspace_id, r.child_workspace_id);
  IF v_reason IS NOT NULL THEN
    UPDATE public.owner_workspace_link_requests
       SET status = 'cancelled', responded_by = auth.uid(), responded_at = now()
     WHERE id = r.id;
    RETURN jsonb_build_object('ok', false, 'reason', v_reason);
  END IF;

  UPDATE public.asset_owner_workspaces
     SET parent_workspace_id = r.parent_workspace_id, parent_linked_at = now()
   WHERE id = r.child_workspace_id;

  UPDATE public.owner_workspace_link_requests
     SET status = 'accepted', responded_by = auth.uid(), responded_at = now()
   WHERE id = r.id;

  -- Yêu cầu khác gửi tới trạm này, và yêu cầu trạm này đang gửi đi với tư cách trụ sở,
  -- đều hết hiệu lực.
  UPDATE public.owner_workspace_link_requests
     SET status = 'cancelled', responded_at = now()
   WHERE status = 'pending' AND id <> r.id
     AND (child_workspace_id = r.child_workspace_id OR parent_workspace_id = r.child_workspace_id);

  RETURN jsonb_build_object('ok', true, 'status', 'accepted');
END;
$$;

-- Một trong hai Trưởng đơn vị huỷ liên kết.
CREATE OR REPLACE FUNCTION public.owner_ws_unlink(p_child_ws UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.asset_owner_workspaces%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('owner_ws_link'));
  SELECT * INTO c FROM public.asset_owner_workspaces WHERE id = p_child_ws;
  IF NOT FOUND
     OR NOT (public.owner_ws_can(c.id, 'manage_workspace')
             OR (c.parent_workspace_id IS NOT NULL
                 AND public.owner_ws_can(c.parent_workspace_id, 'manage_workspace'))) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'link_not_found');
  END IF;
  IF c.parent_workspace_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'link_not_linked');
  END IF;

  UPDATE public.owner_workspace_link_requests
     SET status = 'unlinked', ended_by = auth.uid(), ended_at = now()
   WHERE parent_workspace_id = c.parent_workspace_id
     AND child_workspace_id = c.id
     AND status = 'accepted';

  UPDATE public.asset_owner_workspaces
     SET parent_workspace_id = NULL, parent_linked_at = NULL
   WHERE id = c.id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_ws_link_overview(UUID)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_request_link(UUID, UUID)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_cancel_link_request(UUID)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_respond_link(UUID, BOOLEAN)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_unlink(UUID)                     FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_ws_link_overview(UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_request_link(UUID, UUID)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_cancel_link_request(UUID)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_respond_link(UUID, BOOLEAN)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_unlink(UUID)                  TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Quyền đọc của trụ sở
-- ═══════════════════════════════════════════════════════════════════════════

-- Thành viên trực tiếp: ma trận cũ, không đổi. KHÔNG phải thành viên: chỉ 'read', và
-- chỉ khi mình là Trưởng đơn vị (đang hoạt động) của Trạm cha đã liên kết.
-- owner_ws_role GIỮ NGUYÊN "chỉ thành viên" — owner_ws_members_guard dựa vào nó.
CREATE OR REPLACE FUNCTION public.owner_ws_can(p_workspace_id UUID, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    CASE public.owner_ws_role(p_workspace_id)
      WHEN 'owner'  THEN p_action IN ('read', 'write', 'manage_members', 'manage_workspace', 'send_report')
      WHEN 'staff'  THEN p_action IN ('read', 'write')
      WHEN 'viewer' THEN p_action = 'read'
      ELSE p_action = 'read' AND EXISTS (
        SELECT 1
          FROM public.asset_owner_workspaces c
          JOIN public.asset_owner_workspace_members m ON m.workspace_id = c.parent_workspace_id
         WHERE c.id = p_workspace_id
           AND m.user_id = auth.uid()
           AND m.status = 'active'
           AND m.role = 'owner')
    END,
    false
  )
$$;

-- Danh sách thành viên chi nhánh chỉ thành viên trực tiếp thấy.
DROP POLICY asset_owner_workspace_members_read ON public.asset_owner_workspace_members;
CREATE POLICY asset_owner_workspace_members_read ON public.asset_owner_workspace_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.owner_ws_role(workspace_id) IS NOT NULL);

CREATE OR REPLACE FUNCTION public.owner_ws_list_members(p_workspace_id uuid)
 RETURNS TABLE(member_id uuid, user_id uuid, full_name text, email text, role text, branch_scope uuid[], status text, joined_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT m.id, m.user_id, p.name, p.email, m.role, m.branch_scope, m.status, m.joined_at
    FROM public.asset_owner_workspace_members m
    JOIN public.profiles p ON p.id = m.user_id
   WHERE m.workspace_id = p_workspace_id
     AND m.status = 'active'
     AND public.owner_ws_role(p_workspace_id) IS NOT NULL
   ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'staff' THEN 1 ELSE 2 END,
            m.joined_at NULLS LAST,
            p.email
$function$;

-- Giấy tờ hồ sơ số hoá (bucket asset-docs): thêm các Trạm con của trạm mình làm
-- Trưởng đơn vị. Giữ dạng IN-list (lọc hồ sơ trước) thay vì gọi owner_ws_can mỗi dòng.
CREATE OR REPLACE FUNCTION public.owner_asset_doc_readable(_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.asset_postings p
     WHERE p.workspace_id IN (SELECT m.workspace_id FROM public.asset_owner_workspace_members m
                               WHERE m.user_id = auth.uid() AND m.status = 'active'
                              UNION ALL
                              SELECT c.id FROM public.asset_owner_workspaces c
                                JOIN public.asset_owner_workspace_members m
                                  ON m.workspace_id = c.parent_workspace_id
                               WHERE m.user_id = auth.uid() AND m.status = 'active' AND m.role = 'owner')
       AND (_name = ANY (COALESCE(p.ownership_proof_urls, '{}') || COALESCE(p.doc_urls, '{}'))
            OR EXISTS (SELECT 1 FROM public.asset_legal_consultations c
                        WHERE c.asset_posting_id = p.id
                          AND _name = ANY (COALESCE(c.submitted_doc_paths, '{}'))))
       AND public.owner_posting_file_owner_ok(p.workspace_id, p.user_id,
                                              public.consignment_path_uuid(_name, 1))
  )
$function$;

-- Link báo cáo: chỉ thành viên TRỰC TIẾP không được đếm lượt xem — trụ sở đã liên kết
-- là người đọc thật. Mỗi lượt đếm được kiểm tín hiệu bán hàng (mục 4).
CREATE OR REPLACE FUNCTION public.get_shared_owner_report(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.owner_report_snapshots%ROWTYPE;
BEGIN
  IF p_token IS NULL OR p_token !~ '^[A-Za-z0-9_-]{43}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO r FROM public.owner_report_snapshots
   WHERE share_token = p_token AND status = 'final';
  -- Thu hồi và token sai không phân biệt được — cùng một thông báo.
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF r.token_expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired', 'expired_at', r.token_expires_at);
  END IF;

  -- Chỉ đếm người ngoài đơn vị (thành viên TRỰC TIẾP mở thử link không tính; trụ sở
  -- đã liên kết vẫn được đếm).
  IF auth.uid() IS NULL OR public.owner_ws_role(r.workspace_id) IS NULL THEN
    UPDATE public.owner_report_snapshots
       SET view_count = view_count + 1, last_viewed_at = now()
     WHERE id = r.id;
    -- Tín hiệu bán hàng (Phase 14) — tự thoát sớm khi chưa đủ lượt / đã có lead.
    PERFORM public.owner_hq_signal_from_report(r.id);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'report', jsonb_build_object(
      'payload',    public.owner_report_public_payload(r.payload),
      'expires_at', r.token_expires_at
    )
  );
END;
$function$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. So sánh ẩn danh giữa các chi nhánh
-- ═══════════════════════════════════════════════════════════════════════════

-- Lõi tính toán KHÔNG kiểm quyền — chỉ hàm DEFINER khác gọi (so sánh cần số của các
-- Trạm mà người gọi không đọc được). Thân hàm chép nguyên từ bản đang chạy (P8), chỉ
-- bỏ khối kiểm quyền; overview_core gọi resolved_core.
CREATE OR REPLACE FUNCTION public.owner_asset_outcomes_resolved_core(p_workspace_id uuid)
 RETURNS TABLE(listing_id uuid, resolved_outcome text, resolved_price numeric, resolved_date date, payment_status text, confidence_label text, has_conflict boolean, sources jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT DISTINCT c.listing_id AS lid
      FROM public.asset_owner_claims c
     WHERE c.workspace_id = p_workspace_id
       AND c.status IN ('auto_claimed', 'pending_confirmation', 'confirmed')
       AND c.listing_id IS NOT NULL
  ),
  platform AS (
    SELECT DISTINCT ON (i.listing_id)
           i.listing_id                                         AS lid,
           'platform'::text                                     AS kind,
           1                                                    AS rnk,
           'platform'::text                                     AS label,
           CASE
             WHEN s.status = 'cancelled'   THEN 'cancelled'
             WHEN ls.status = 'withdrawn'  THEN 'withdrawn'
             ELSE ls.result
           END                                                  AS outcome,
           CASE WHEN s.status = 'published' AND ls.result = 'sold'
                THEN COALESCE(sc.price, ls.winning_amount) END  AS price,
           (COALESCE(ls.closed_at, ls.updated_at) AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS odate,
           CASE WHEN s.status = 'published' AND ls.result = 'sold'
                THEN ls.payment_status END                      AS pay,
           jsonb_build_object(
             'ref_id',          i.id,
             'org_name',        ao.name,
             'session_code',    s.code,
             'contract_code',   sc.code,
             'contract_status', sc.status
           )                                                    AS ref
      FROM public.auction_session_items i
      JOIN claimed cl                     ON cl.lid = i.listing_id
      JOIN public.auction_sessions s      ON s.id = i.session_id
                                         AND s.status IN ('published', 'cancelled')
      JOIN public.auction_lot_states ls   ON ls.lot_id = i.id
                                         AND ls.status IN ('closed', 'withdrawn')
      LEFT JOIN public.auction_sale_contracts sc ON sc.lot_id = i.id AND sc.status <> 'cancelled'
      LEFT JOIN public.auction_organizations ao  ON ao.id = s.auction_org_id
     WHERE i.source = 'listing'
     ORDER BY i.listing_id, COALESCE(ls.closed_at, ls.updated_at) DESC
  ),
  org_report AS (
    SELECT r.listing_id                                         AS lid,
           'org_report'::text                                   AS kind,
           CASE WHEN r.source = 'CRAWLED' THEN 5 ELSE 4 END     AS rnk,
           CASE WHEN r.source = 'CRAWLED' THEN 'estimated' ELSE 'self_reported' END AS label,
           CASE WHEN r.is_successful THEN 'sold' ELSE 'unsold' END AS outcome,
           CASE WHEN r.is_successful THEN r.winning_price END   AS price,
           r.auction_date                                       AS odate,
           NULL::text                                           AS pay,
           jsonb_build_object(
             'ref_id',   r.id,
             'org_name', COALESCE(ao.name, o.name)
           )                                                    AS ref
      FROM public.org_auction_records r
      JOIN claimed cl                           ON cl.lid = r.listing_id
      LEFT JOIN public.auction_organizations ao ON ao.id = r.auction_org_id
      LEFT JOIN public.organizations o          ON o.id = r.organization_id
     WHERE r.is_successful IS NOT NULL
  ),
  owner_latest AS (
    SELECT DISTINCT ON (o.listing_id)
           o.id                                AS oid,
           o.listing_id                        AS lid,
           o.round_no                          AS rno,
           o.auction_date                      AS odate,
           o.outcome                           AS outcome,
           o.winning_price                     AS price,
           o.payment_status                    AS pay,
           cardinality(o.evidence_urls) > 0    AS has_evidence,
           o.auction_org_id                    AS org_id,
           COALESCE(o.conflict_resolution->'dismissed', '[]'::jsonb) AS dismissed_fps
      FROM public.owner_asset_outcomes o
      JOIN claimed cl ON cl.lid = o.listing_id
     WHERE o.workspace_id = p_workspace_id
     ORDER BY o.listing_id, o.round_no DESC, o.auction_date DESC, o.updated_at DESC
  ),
  owner_report AS (
    SELECT ol.lid                                               AS lid,
           'owner_report'::text                                 AS kind,
           CASE WHEN rec.ok THEN 2 WHEN ol.has_evidence THEN 3 ELSE 4 END AS rnk,
           CASE WHEN rec.ok THEN 'reconciled'
                WHEN ol.has_evidence THEN 'owner_evidence'
                ELSE 'self_reported' END                        AS label,
           ol.outcome                                           AS outcome,
           CASE WHEN ol.outcome = 'sold' THEN ol.price END      AS price,
           ol.odate                                             AS odate,
           CASE WHEN ol.outcome = 'sold' THEN ol.pay END        AS pay,
           jsonb_build_object(
             'ref_id',   ol.oid,
             'org_name', ao.name,
             'round_no', ol.rno
           )                                                    AS ref
      FROM owner_latest ol
      LEFT JOIN public.auction_organizations ao ON ao.id = ol.org_id
      CROSS JOIN LATERAL (
        SELECT EXISTS (
          SELECT 1 FROM org_report r
           WHERE r.lid = ol.lid
             AND r.rnk = 4
             AND (r.odate IS NULL OR abs(r.odate - ol.odate) <= 7)
             AND r.outcome = ol.outcome
             AND (ol.outcome <> 'sold'
                  OR (r.price IS NOT NULL AND ol.price IS NOT NULL
                      AND abs(r.price - ol.price) <= 0.01 * greatest(r.price, ol.price)))
        ) AS ok
      ) rec
  ),
  crawled AS (
    SELECT l.id                                                 AS lid,
           'crawled'::text                                      AS kind,
           5                                                    AS rnk,
           'estimated'::text                                    AS label,
           'sold'::text                                         AS outcome,
           p.price                                              AS price,
           (public.try_timestamptz(COALESCE(l.custom_attributes->>'auction_time',
                                            l.custom_attributes->>'auction_date'))
              AT TIME ZONE 'Asia/Ho_Chi_Minh')::date            AS odate,
           NULL::text                                           AS pay,
           jsonb_build_object(
             'ref_id',         l.id,
             'listing_status', l.status
           )                                                    AS ref
      FROM public.listings l
      JOIN claimed cl ON cl.lid = l.id
      CROSS JOIN LATERAL (
        SELECT NULLIF(CASE WHEN t.v ~ '^[0-9]+(\.[0-9]+)?$' THEN t.v::numeric END, 0) AS price
          FROM (SELECT regexp_replace(
                         COALESCE(l.custom_attributes->>'winning_price',
                                  l.custom_attributes->>'win_price'),
                         '[^0-9.]', '', 'g') AS v) t
      ) p
     WHERE p.price IS NOT NULL OR l.status = 'SOLD_RENTED'
  ),
  cand0 AS (
    SELECT * FROM platform
    UNION ALL SELECT * FROM owner_report
    UNION ALL SELECT * FROM org_report
    UNION ALL SELECT * FROM crawled
  ),
  cand AS (
    SELECT c.*,
           public.owner_outcome_source_fp(c.kind, c.ref->>'ref_id', c.outcome, c.price) AS fp,
           (c.kind NOT IN ('platform', 'owner_report')
            AND COALESCE(ol.dismissed_fps, '[]'::jsonb)
                ? public.owner_outcome_source_fp(c.kind, c.ref->>'ref_id', c.outcome, c.price)) AS dismissed
      FROM cand0 c
      LEFT JOIN owner_latest ol ON ol.lid = c.lid
  ),
  latest AS (
    SELECT c.lid, max(c.odate) AS last_date
      FROM cand c
     WHERE NOT c.dismissed
     GROUP BY c.lid
  ),
  ranked AS (
    SELECT c.*,
           (c.odate IS NULL OR lt.last_date IS NULL OR c.odate >= lt.last_date - 7) AS in_round,
           row_number() OVER (
             PARTITION BY c.lid
             ORDER BY (c.odate IS NULL OR lt.last_date IS NULL OR c.odate >= lt.last_date - 7) DESC,
                      c.dismissed,
                      c.rnk,
                      c.odate DESC NULLS LAST,
                      CASE c.kind WHEN 'platform'     THEN 1
                                  WHEN 'owner_report' THEN 2
                                  WHEN 'crawled'      THEN 3
                                  ELSE 4 END
           ) AS pos
      FROM cand c
      LEFT JOIN latest lt ON lt.lid = c.lid
  ),
  best AS (
    SELECT * FROM ranked WHERE pos = 1
  ),
  conflict AS (
    SELECT b.lid,
           bool_or(public.owner_outcome_disagrees(o.outcome, o.price, o.odate,
                                                  b.outcome, b.price, b.odate)) AS conflicted
      FROM best b
      JOIN ranked o ON o.lid = b.lid AND o.pos > 1 AND NOT o.dismissed
     GROUP BY b.lid
  ),
  src AS (
    SELECT r.lid,
           jsonb_agg(
             jsonb_build_object(
               'kind',           r.kind,
               'label',          r.label,
               'outcome',        r.outcome,
               'price',          r.price,
               'date',           r.odate,
               'payment_status', r.pay,
               'fp',             r.fp,
               'dismissed',      r.dismissed,
               'in_round',       r.in_round,
               'disagrees',      (r.pos > 1 AND public.owner_outcome_disagrees(
                                    r.outcome, r.price, r.odate, b.outcome, b.price, b.odate))
             ) || r.ref
             ORDER BY r.pos
           ) AS list
      FROM ranked r
      JOIN best b ON b.lid = r.lid
     GROUP BY r.lid
  )
  SELECT cl.lid,
         b.outcome,
         b.price,
         b.odate,
         b.pay,
         b.label,
         COALESCE(cf.conflicted, false),
         COALESCE(s.list, '[]'::jsonb)
    FROM claimed cl
    LEFT JOIN best b      ON b.lid = cl.lid
    LEFT JOIN conflict cf ON cf.lid = cl.lid
    LEFT JOIN src s       ON s.lid = cl.lid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_outcomes_overview_core(p_workspace_id uuid)
 RETURNS TABLE(row_key text, listing_id uuid, title_key text, own_outcome_id uuid, own_round_no integer, rounds_reported integer, asset_title text, asset_category text, branch_id uuid, auction_org_name text, starting_price numeric, resolved_outcome text, resolved_price numeric, resolved_date date, payment_status text, paid_amount numeric, best_kind text, confidence_label text, has_conflict boolean, sources jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  WITH res AS (
    SELECT x.* FROM public.owner_asset_outcomes_resolved_core(p_workspace_id) x
     WHERE x.resolved_outcome IS NOT NULL
  ),
  own_src AS (
    -- Bản ghi của chính đơn vị = nguồn owner_report (chỉ có lượt mới nhất).
    SELECT r.listing_id                       AS lid,
           (e->>'ref_id')::uuid               AS oid,
           (e->>'round_no')::int              AS rno,
           COALESCE((e->>'in_round')::boolean, false) AS in_round
      FROM res r
      CROSS JOIN LATERAL jsonb_array_elements(r.sources) e
     WHERE e->>'kind' = 'owner_report'
  ),
  own_count AS (
    SELECT o.listing_id AS lid, count(*)::int AS n
      FROM public.owner_asset_outcomes o
     WHERE o.workspace_id = p_workspace_id AND o.listing_id IS NOT NULL
     GROUP BY o.listing_id
  ),
  branch_of AS (
    SELECT DISTINCT ON (c.listing_id) c.listing_id AS lid, wb.id AS bid
      FROM public.asset_owner_claims c
      JOIN public.workspace_branches wb
        ON wb.workspace_id = c.workspace_id AND wb.asset_owner_id = c.asset_owner_id
     WHERE c.workspace_id = p_workspace_id AND c.listing_id IS NOT NULL
     ORDER BY c.listing_id, c.created_at
  ),
  off_all AS (
    SELECT o.*
      FROM public.owner_asset_outcomes o
     WHERE o.workspace_id = p_workspace_id
       AND o.listing_id IS NULL
       AND o.asset_posting_id IS NULL
  ),
  off_latest AS (
    SELECT DISTINCT ON (o.title_key) o.*
      FROM off_all o
     ORDER BY o.title_key, o.round_no DESC, o.auction_date DESC, o.updated_at DESC
  ),
  off_count AS (
    SELECT o.title_key AS tk, count(*)::int AS n FROM off_all o GROUP BY o.title_key
  )
  SELECT ('l:' || r.listing_id::text)::text,
         r.listing_id,
         NULL::text,
         os.oid,
         os.rno,
         COALESCE(oc.n, 0)::int,
         l.title::text,
         l.property_type_slug::text,
         bo.bid,
         COALESCE(r.sources->0->>'org_name', ao.name)::text,
         (CASE WHEN l.price_unit::text = 'TOTAL' AND l.price > 0 THEN l.price END)::numeric,
         r.resolved_outcome,
         r.resolved_price::numeric,
         r.resolved_date,
         r.payment_status,
         (CASE WHEN os.in_round THEN oo.paid_amount END)::numeric,
         (r.sources->0->>'kind')::text,
         r.confidence_label,
         r.has_conflict,
         r.sources
    FROM res r
    JOIN public.listings l                    ON l.id = r.listing_id
    LEFT JOIN own_src os                      ON os.lid = r.listing_id
    LEFT JOIN public.owner_asset_outcomes oo  ON oo.id = os.oid
    LEFT JOIN own_count oc                    ON oc.lid = r.listing_id
    LEFT JOIN branch_of bo                    ON bo.lid = r.listing_id
    LEFT JOIN public.auction_organizations ao ON ao.id = l.auction_org_id
  UNION ALL
  SELECT ('t:' || f.title_key)::text,
         NULL::uuid,
         f.title_key,
         f.id,
         f.round_no,
         COALESCE(fc.n, 0)::int,
         f.asset_title,
         f.asset_category,
         f.branch_id,
         ao.name::text,
         f.starting_price::numeric,
         f.outcome,
         (CASE WHEN f.outcome = 'sold' THEN f.winning_price END)::numeric,
         f.auction_date,
         CASE WHEN f.outcome = 'sold' THEN f.payment_status END,
         (CASE WHEN f.outcome = 'sold' THEN f.paid_amount END)::numeric,
         'owner_report'::text,
         lbl.label,
         false,
         jsonb_build_array(jsonb_build_object(
           'kind',           'owner_report',
           'label',          lbl.label,
           'outcome',        f.outcome,
           'price',          CASE WHEN f.outcome = 'sold' THEN f.winning_price END,
           'date',           f.auction_date,
           'payment_status', CASE WHEN f.outcome = 'sold' THEN f.payment_status END,
           'fp',             public.owner_outcome_source_fp('owner_report', f.id::text, f.outcome,
                                CASE WHEN f.outcome = 'sold' THEN f.winning_price END),
           'dismissed',      false,
           'in_round',       true,
           'disagrees',      false,
           'ref_id',         f.id,
           'org_name',       ao.name,
           'round_no',       f.round_no
         ))
    FROM off_latest f
    LEFT JOIN off_count fc                    ON fc.tk = f.title_key
    LEFT JOIN public.auction_organizations ao ON ao.id = f.auction_org_id
    CROSS JOIN LATERAL (
      SELECT CASE WHEN cardinality(f.evidence_urls) > 0 THEN 'owner_evidence' ELSE 'self_reported' END::text AS label
    ) lbl;
END;
$function$;

REVOKE ALL ON FUNCTION public.owner_asset_outcomes_resolved_core(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_outcomes_overview_core(UUID)       FROM PUBLIC, anon, authenticated;

-- Hàm công khai: chữ ký ĐÓNG BĂNG (P5), vẫn plpgsql để giữ lỗi 42501.
CREATE OR REPLACE FUNCTION public.owner_asset_outcomes_resolved(p_workspace_id uuid)
 RETURNS TABLE(listing_id uuid, resolved_outcome text, resolved_price numeric, resolved_date date, payment_status text, confidence_label text, has_conflict boolean, sources jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT * FROM public.owner_asset_outcomes_resolved_core(p_workspace_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_outcomes_overview(p_workspace_id uuid)
 RETURNS TABLE(row_key text, listing_id uuid, title_key text, own_outcome_id uuid, own_round_no integer, rounds_reported integer, asset_title text, asset_category text, branch_id uuid, auction_org_name text, starting_price numeric, resolved_outcome text, resolved_price numeric, resolved_date date, payment_status text, paid_amount numeric, best_kind text, confidence_label text, has_conflict boolean, sources jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.owner_ws_can(p_workspace_id, 'read') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY SELECT * FROM public.owner_outcomes_overview_core(p_workspace_id);
END;
$function$;

-- Một chỉ số: đủ ≥ 3 chi nhánh có số ⇒ vị trí so với trung vị; ≥ 5 ⇒ thêm tứ phân vị
-- (làm tròn theo p_step). Không bao giờ trả min / max / thứ hạng.
CREATE OR REPLACE FUNCTION public.owner_benchmark_metric(
  p_vals NUMERIC[], p_self NUMERIC, p_higher_better BOOLEAN, p_step NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  c_min_peers   CONSTANT INT := 3;
  c_exact_peers CONSTANT INT := 5;
  n     INT := COALESCE(cardinality(p_vals), 0);
  q     FLOAT8[];
  v_pos TEXT;
BEGIN
  IF n < c_min_peers OR (n < c_exact_peers AND p_self IS NULL) THEN
    RETURN NULL;
  END IF;

  SELECT percentile_cont(ARRAY[0.25, 0.5, 0.75]::float8[]) WITHIN GROUP (ORDER BY v)
    INTO q
    FROM unnest(p_vals) v;

  IF p_self IS NOT NULL THEN
    v_pos := CASE
      WHEN abs(p_self - q[2]::numeric) < p_step / 2 THEN 'same'
      WHEN (p_self > q[2]::numeric) = p_higher_better THEN 'better'
      ELSE 'worse'
    END;
  END IF;

  IF n < c_exact_peers THEN
    RETURN jsonb_build_object('n', n, 'position', v_pos);
  END IF;

  RETURN jsonb_build_object(
    'n',        n,
    'position', v_pos,
    'self',     round(p_self / p_step) * p_step,
    'p25',      round(q[1]::numeric / p_step) * p_step,
    'p50',      round(q[2]::numeric / p_step) * p_step,
    'p75',      round(q[3]::numeric / p_step) * p_step
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_benchmark_metric(NUMERIC[], NUMERIC, BOOLEAN, NUMERIC)
  FROM PUBLIC, anon, authenticated;

-- So sánh Trạm với các Trạm cùng công ty mẹ (asset_owners.parent_owner_id).
-- CHỈ thành viên trực tiếp: trụ sở đã liên kết đọc được số thật của chi nhánh con,
-- gọi được hàm này thì trừ ngược ra số của chi nhánh CHƯA đồng ý chia sẻ.
--   · Tỷ lệ thành công = bán / tài sản có kết quả trong 12 tháng (cùng định nghĩa
--     trang "Kết quả phiên" và báo cáo định kỳ; KHÔNG phải ô KPI ở Nhịp đập, vốn chia
--     cho cả tài sản chưa đấu). Chi nhánh cần ≥ 3 kết quả.
--   · Thời gian đến khi bán = trung vị (ngày bán − ngày đầu tiên biết tài sản), chỉ tài
--     sản trên sàn đã bán, âm ⇒ 0. Chi nhánh cần ≥ 3 tài sản.
CREATE OR REPLACE FUNCTION public.owner_ws_benchmark(p_workspace_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_window_days CONSTANT INT := 365;
  c_min_sample  CONSTANT INT := 3;
  v_as_of   DATE := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
  v_entity  UUID;
  v_parent  UUID;
  v_s_vals  NUMERIC[];
  v_s_self  NUMERIC;
  v_d_vals  NUMERIC[];
  v_d_self  NUMERIC;
  v_success JSONB;
  v_days    JSONB;
BEGIN
  IF public.owner_ws_role(p_workspace_id) IS NULL THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT w.asset_owner_id, ao.parent_owner_id
    INTO v_entity, v_parent
    FROM public.asset_owner_workspaces w
    LEFT JOIN public.asset_owners ao ON ao.id = w.asset_owner_id
   WHERE w.id = p_workspace_id;
  IF v_parent IS NULL THEN
    RETURN jsonb_build_object('available', false);
  END IF;

  WITH peers AS (
    -- Mỗi pháp nhân một Trạm (chính mình thắng, rồi Trạm chi nhánh 'entity').
    SELECT DISTINCT ON (w.asset_owner_id) w.id AS ws_id, (w.id = p_workspace_id) AS is_self
      FROM public.asset_owner_workspaces w
      JOIN public.asset_owners ao ON ao.id = w.asset_owner_id
     WHERE ao.parent_owner_id = v_parent
     ORDER BY w.asset_owner_id, (w.id = p_workspace_id) DESC, (w.match_scope = 'entity') DESC, w.created_at
  ),
  ov AS (
    SELECT p.ws_id, p.is_self, o.listing_id, o.resolved_outcome, o.resolved_date
      FROM peers p
      CROSS JOIN LATERAL public.owner_outcomes_overview_core(p.ws_id) o
     WHERE o.resolved_date BETWEEN v_as_of - c_window_days AND v_as_of
  ),
  success AS (
    SELECT ov.ws_id, bool_or(ov.is_self) AS is_self,
           count(*) FILTER (WHERE ov.resolved_outcome = 'sold') * 100.0 / count(*) AS val
      FROM ov
     GROUP BY ov.ws_id
    HAVING count(*) >= c_min_sample
  ),
  -- Ngày đầu tiên biết tài sản: cùng công thức stuck_l của owner_build_report_payload
  -- (P10) — đây là bản chép thứ 3, sửa một chỗ thì sửa cả hai.
  sold AS (
    SELECT ov.ws_id, ov.is_self, ov.resolved_date,
           least(
             (SELECT min(s.session_date) FROM public.listing_price_sessions s
               WHERE s.listing_id = ov.listing_id),
             (SELECT min(o.auction_date) FROM public.owner_asset_outcomes o
               WHERE o.workspace_id = ov.ws_id AND o.listing_id = ov.listing_id),
             (l.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
           ) AS first_date
      FROM ov
      JOIN public.listings l ON l.id = ov.listing_id
     WHERE ov.resolved_outcome = 'sold'
  ),
  days AS (
    SELECT s.ws_id, bool_or(s.is_self) AS is_self,
           percentile_cont(0.5) WITHIN GROUP (
             ORDER BY greatest(s.resolved_date - s.first_date, 0))::numeric AS val
      FROM sold s
     GROUP BY s.ws_id
    HAVING count(*) >= c_min_sample
  )
  SELECT (SELECT array_agg(val) FROM success),
         (SELECT val FROM success WHERE is_self),
         (SELECT array_agg(val) FROM days),
         (SELECT val FROM days WHERE is_self)
    INTO v_s_vals, v_s_self, v_d_vals, v_d_self;

  v_success := public.owner_benchmark_metric(v_s_vals, v_s_self, true, 5);
  v_days    := public.owner_benchmark_metric(v_d_vals, v_d_self, false, 1);

  IF v_success IS NULL AND v_days IS NULL THEN
    RETURN jsonb_build_object('available', false);
  END IF;
  RETURN jsonb_build_object(
    'available',    true,
    'window_days',  c_window_days,
    'success_rate', v_success,
    'days_to_sale', v_days
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_ws_benchmark(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_ws_benchmark(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Tín hiệu bán hàng → lead 'owner_hq_expansion'
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_source_check CHECK (
  source = ANY (ARRAY['contact_form','partnership_form','hotline','email','referral',
    'event','ads','tool_marketplace','market_data','asset_brokerage','owner_hq_expansion','other']));

-- Lead tín hiệu luôn trỏ tới pháp nhân công ty mẹ ⇒ unique theo prospect_id.
ALTER TABLE public.leads ADD CONSTRAINT leads_hq_expansion_prospect_check CHECK (
  source IS DISTINCT FROM 'owner_hq_expansion'
  OR (prospect_kind = 'asset_owner' AND prospect_id IS NOT NULL));

CREATE UNIQUE INDEX uniq_leads_owner_hq_expansion
  ON public.leads (prospect_id)
  WHERE source = 'owner_hq_expansion';

-- Nguồn / pháp nhân của lead tín hiệu không đổi được (đổi đi thì index unique không còn
-- phủ ⇒ tín hiệu sau tạo lead thứ hai); cũng không được đổi lead khác THÀNH nguồn này.
CREATE OR REPLACE FUNCTION public.leads_system_source_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (OLD.source = 'owner_hq_expansion' OR NEW.source = 'owner_hq_expansion')
     AND (NEW.source        IS DISTINCT FROM OLD.source
          OR NEW.prospect_kind IS DISTINCT FROM OLD.prospect_kind
          OR NEW.prospect_id   IS DISTINCT FROM OLD.prospect_id) THEN
    RAISE EXCEPTION 'lead_system_source_locked' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER leads_system_source_guard
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_system_source_guard();

REVOKE ALL ON FUNCTION public.leads_system_source_guard() FROM PUBLIC, anon, authenticated;

-- Tạo (tối đa MỘT) lead cho công ty mẹ. Không bao giờ làm hỏng giao dịch gọi nó
-- (duyệt KYC, mở link báo cáo) — lỗi chỉ thành WARNING.
CREATE OR REPLACE FUNCTION public.owner_hq_expansion_signal(p_parent_owner_id UUID, p_detail TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner public.asset_owners%ROWTYPE;
  v_other TEXT;
  v_id    UUID;
BEGIN
  IF p_parent_owner_id IS NULL
     OR EXISTS (SELECT 1 FROM public.leads l
                 WHERE l.source = 'owner_hq_expansion' AND l.prospect_id = p_parent_owner_id) THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_owner FROM public.asset_owners WHERE id = p_parent_owner_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Lead sẵn có cho cùng đơn vị (thường là 'market_data') — ghi mã vào ghi chú để sale
  -- gộp tay nếu muốn.
  SELECT l.code INTO v_other
    FROM public.leads l
   WHERE (l.prospect_kind = 'asset_owner' AND l.prospect_id = p_parent_owner_id)
      OR public.normalize_org_name(COALESCE(l.company_name, l.name)) = public.normalize_org_name(v_owner.name)
   ORDER BY l.created_at DESC
   LIMIT 1;

  INSERT INTO public.leads (name, company_name, lead_type, source, status, note, prospect_kind, prospect_id)
  VALUES (
    v_owner.name,
    v_owner.name,
    CASE WHEN v_owner.owner_kind = 'bank_credit' THEN 'bank' ELSE 'asset_owner' END,
    'owner_hq_expansion',
    'new',
    'Tín hiệu Tháp Điều Hành: ' || p_detail
      || COALESCE(' Đã có lead ' || v_other || ' cho đơn vị này.', ''),
    'asset_owner',
    p_parent_owner_id
  )
  ON CONFLICT (prospect_id) WHERE source = 'owner_hq_expansion' DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'owner_hq_expansion_signal(%): %', p_parent_owner_id, SQLERRM;
  RETURN NULL;
END;
$$;

-- Tín hiệu 1: ≥ 3 đơn vị con (pháp nhân khác nhau) của cùng công ty mẹ có Trạm.
CREATE OR REPLACE FUNCTION public.owner_hq_check_branch_signal(p_parent_owner_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_min_branches CONSTANT INT := 3;
  v_n     INT;
  v_names TEXT;
BEGIN
  IF p_parent_owner_id IS NULL
     OR EXISTS (SELECT 1 FROM public.leads l
                 WHERE l.source = 'owner_hq_expansion' AND l.prospect_id = p_parent_owner_id) THEN
    RETURN;
  END IF;
  -- Hai lượt duyệt KYC song song: không khoá thì mỗi bên chỉ thấy 2 ⇒ không ai bắn.
  PERFORM pg_advisory_xact_lock(hashtext('owner_hq_signal:' || p_parent_owner_id::text));

  SELECT count(DISTINCT w.asset_owner_id), string_agg(DISTINCT ao.name, '; ')
    INTO v_n, v_names
    FROM public.asset_owner_workspaces w
    JOIN public.asset_owners ao ON ao.id = w.asset_owner_id
   WHERE ao.parent_owner_id = p_parent_owner_id;

  IF v_n >= c_min_branches THEN
    PERFORM public.owner_hq_expansion_signal(
      p_parent_owner_id,
      format('%s đơn vị con đang dùng Trạm Điều Hành (%s).', v_n, v_names));
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'owner_hq_check_branch_signal(%): %', p_parent_owner_id, SQLERRM;
END;
$$;

-- Tín hiệu 2: một link báo cáo được người ngoài đơn vị mở ≥ 10 lần. Gọi sau MỖI lượt
-- đếm (thoát sớm khi chưa tới ngưỡng / đã có lead) ⇒ lỗi tạm thời được thử lại.
CREATE OR REPLACE FUNCTION public.owner_hq_signal_from_report(p_snapshot_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_min_views CONSTANT INT := 10;
  r        RECORD;
BEGIN
  SELECT s.view_count, s.period_type, s.period_start, w.primary_name, ao.parent_owner_id
    INTO r
    FROM public.owner_report_snapshots s
    JOIN public.asset_owner_workspaces w ON w.id = s.workspace_id
    LEFT JOIN public.asset_owners ao     ON ao.id = w.asset_owner_id
   WHERE s.id = p_snapshot_id;
  IF NOT FOUND OR r.view_count < c_min_views OR r.parent_owner_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.owner_hq_expansion_signal(
    r.parent_owner_id,
    format('Báo cáo định kỳ của «%s» (%s %s) đã được mở %s lần qua link chia sẻ.',
           r.primary_name,
           CASE r.period_type WHEN 'month' THEN 'tháng' WHEN 'quarter' THEN 'quý' ELSE 'năm' END,
           to_char(r.period_start, 'MM/YYYY'),
           r.view_count));
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'owner_hq_signal_from_report(%): %', p_snapshot_id, SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_hq_expansion_signal(UUID, TEXT)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_hq_check_branch_signal(UUID)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_hq_signal_from_report(UUID)      FROM PUBLIC, anon, authenticated;

-- Trạm mới / Trạm đổi pháp nhân.
CREATE OR REPLACE FUNCTION public.owner_ws_entity_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Đổi pháp nhân ⇒ các yêu cầu liên kết đang chờ không còn đúng đối tượng.
    UPDATE public.owner_workspace_link_requests
       SET status = 'cancelled', responded_at = now()
     WHERE status = 'pending'
       AND (parent_workspace_id = NEW.id OR child_workspace_id = NEW.id);
  END IF;
  IF NEW.asset_owner_id IS NOT NULL THEN
    PERFORM public.owner_hq_check_branch_signal(
      (SELECT ao.parent_owner_id FROM public.asset_owners ao WHERE ao.id = NEW.asset_owner_id));
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER asset_owner_workspaces_entity_insert
  AFTER INSERT ON public.asset_owner_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.owner_ws_entity_changed();
CREATE TRIGGER asset_owner_workspaces_entity_update
  AFTER UPDATE OF asset_owner_id ON public.asset_owner_workspaces
  FOR EACH ROW
  WHEN (OLD.asset_owner_id IS DISTINCT FROM NEW.asset_owner_id)
  EXECUTE FUNCTION public.owner_ws_entity_changed();

-- Admin / suy luận đổi công ty mẹ của một pháp nhân đã có Trạm.
CREATE OR REPLACE FUNCTION public.owner_hq_signal_on_reparent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_owner_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.asset_owner_workspaces w WHERE w.asset_owner_id = NEW.id) THEN
    PERFORM public.owner_hq_check_branch_signal(NEW.parent_owner_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER asset_owners_hq_signal
  AFTER UPDATE OF parent_owner_id ON public.asset_owners
  FOR EACH ROW
  WHEN (NEW.parent_owner_id IS DISTINCT FROM OLD.parent_owner_id)
  EXECUTE FUNCTION public.owner_hq_signal_on_reparent();

REVOKE ALL ON FUNCTION public.owner_ws_entity_changed()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_hq_signal_on_reparent() FROM PUBLIC, anon, authenticated;

-- Đánh giá một lần trên dữ liệu hiện có.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT ao.parent_owner_id AS pid
             FROM public.asset_owner_workspaces w
             JOIN public.asset_owners ao ON ao.id = w.asset_owner_id
            WHERE ao.parent_owner_id IS NOT NULL LOOP
    PERFORM public.owner_hq_check_branch_signal(r.pid);
  END LOOP;
  FOR r IN SELECT s.id FROM public.owner_report_snapshots s WHERE s.view_count >= 10 LOOP
    PERFORM public.owner_hq_signal_from_report(r.id);
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Tự kiểm
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_fn TEXT;
BEGIN
  -- Mỗi hàm đúng một bản.
  FOREACH v_fn IN ARRAY ARRAY['owner_ws_can', 'owner_asset_outcomes_resolved', 'owner_outcomes_overview',
                              'owner_asset_outcomes_resolved_core', 'owner_outcomes_overview_core',
                              'owner_ws_benchmark', 'owner_ws_link_overview', 'get_shared_owner_report',
                              'owner_ws_list_members', 'owner_asset_doc_readable'] LOOP
    IF (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = v_fn) <> 1 THEN
      RAISE EXCEPTION 'self-check: % không đúng 1 bản', v_fn;
    END IF;
  END LOOP;

  -- Lõi + hàm nội bộ: không ai ngoài owner gọi được.
  FOREACH v_fn IN ARRAY ARRAY['owner_asset_outcomes_resolved_core(uuid)', 'owner_outcomes_overview_core(uuid)',
                              'owner_hq_expansion_signal(uuid,text)', 'owner_hq_check_branch_signal(uuid)',
                              'owner_hq_signal_from_report(uuid)', 'owner_ws_link_check(uuid,uuid)',
                              'owner_benchmark_metric(numeric[],numeric,boolean,numeric)'] LOOP
    IF has_function_privilege('authenticated', v_fn, 'EXECUTE')
       OR has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'self-check: % còn quyền EXECUTE cho client', v_fn;
    END IF;
  END LOOP;

  -- RPC client: authenticated có, anon không.
  FOREACH v_fn IN ARRAY ARRAY['owner_ws_benchmark(uuid)', 'owner_ws_link_overview(uuid)',
                              'owner_ws_request_link(uuid,uuid)', 'owner_ws_cancel_link_request(uuid)',
                              'owner_ws_respond_link(uuid,boolean)', 'owner_ws_unlink(uuid)',
                              'owner_asset_outcomes_resolved(uuid)', 'owner_outcomes_overview(uuid)'] LOOP
    IF NOT has_function_privilege('authenticated', v_fn, 'EXECUTE')
       OR has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'self-check: quyền EXECUTE của % sai', v_fn;
    END IF;
  END LOOP;

  -- Link công khai vẫn mở cho anon.
  IF NOT has_function_privilege('anon', 'get_shared_owner_report(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'self-check: get_shared_owner_report mất quyền anon';
  END IF;

  -- Cột cây không ghi được từ client.
  IF has_column_privilege('authenticated', 'public.asset_owner_workspaces', 'parent_workspace_id', 'UPDATE') THEN
    RAISE EXCEPTION 'self-check: parent_workspace_id ghi được từ client';
  END IF;
END;
$$;
