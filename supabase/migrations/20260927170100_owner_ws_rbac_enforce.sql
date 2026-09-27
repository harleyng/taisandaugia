-- Vai trò tuỳ chỉnh của Trạm Điều Hành — BƯỚC B: chuyển quyền GHI sang ma trận.
--
-- Sau file này:
--   • Mọi quyền GHI của cổng chủ tài sản = owner_ws_has(ws, module, action) (+ phạm vi
--     chi nhánh qua owner_ws_has_in). Danh mục: owner_ws_permission_catalog().
--   • Đọc KHÔNG đổi: owner_ws_can(ws, 'read') = thành viên trực tiếp, hoặc Trưởng đơn vị
--     (vai trò OWNER) của trụ sở đã liên kết. "Xem" trong ma trận chỉ ẩn/hiện menu.
--   • owner_ws_can với action cũ khác 'read' (write / manage_members / manage_workspace /
--     send_report) RAISE 0A000 — code cũ còn sót phải lỗi RÕ, không lặng lẽ mở quyền.
--   • owner_ws_role(ws) trả về CODE của vai trò ('OWNER', 'STAFF', …); chỉ dùng để thử
--     IS [NOT] NULL (có phải thành viên trực tiếp không).
--   • Người không phải Trưởng đơn vị chỉ gán / mời / sửa vai trò NẰM TRONG quyền của
--     chính mình (và phạm vi chi nhánh nằm trong phạm vi của mình); không sửa vai trò
--     của chính mình.
-- Ngày chuyển không ai được thêm hay mất quyền: self-check cuối file so ma trận mới với
-- vai trò cũ (tier) của từng thành viên, phải 0 khác biệt.

LOCK TABLE public.asset_owner_workspaces,
           public.asset_owner_workspace_members,
           public.asset_owner_workspace_invites,
           public.owner_ws_roles,
           public.owner_ws_role_permissions,
           public.workspace_branches,
           public.asset_owner_claims,
           public.asset_postings,
           public.asset_service_requests,
           public.asset_broker_requests,
           public.owner_asset_outcomes,
           public.owner_cash_events,
           public.owner_workspace_targets,
           public.owner_workspace_target_criteria,
           public.owner_report_snapshots
  IN ACCESS EXCLUSIVE MODE;

-- ─── Helper nền ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_ws_role(p_workspace_id UUID)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.code
    FROM public.asset_owner_workspace_members m
    JOIN public.owner_ws_roles r ON r.id = m.role_id AND r.workspace_id = m.workspace_id
   WHERE m.workspace_id = p_workspace_id
     AND m.user_id = auth.uid()
     AND m.status = 'active'
$$;

-- VOLATILE để planner không bao giờ tính trước nhánh ELSE của CASE.
CREATE FUNCTION public.owner_ws_legacy_action(p_action TEXT)
RETURNS boolean LANGUAGE plpgsql VOLATILE SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'owner_ws_legacy_action: quyền "%" đã bỏ — dùng owner_ws_has(workspace, module, action)', p_action
    USING ERRCODE = '0A000',
          HINT = 'Danh mục ở owner_ws_permission_catalog(); luật ở business-rules mục "Vai trò Trạm Điều Hành".';
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_ws_can(p_workspace_id UUID, p_action TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p_action = 'read' THEN
      public.owner_ws_role(p_workspace_id) IS NOT NULL
      OR EXISTS (
        SELECT 1
          FROM public.asset_owner_workspaces c
          JOIN public.asset_owner_workspace_members m ON m.workspace_id = c.parent_workspace_id
          JOIN public.owner_ws_roles r ON r.id = m.role_id AND r.workspace_id = m.workspace_id
         WHERE c.id = p_workspace_id
           AND m.user_id = auth.uid()
           AND m.status = 'active'
           AND r.is_system)
    ELSE public.owner_ws_legacy_action(p_action)
  END
$$;

-- Trưởng đơn vị hoặc người không bị giới hạn ⇒ true; bản ghi không thuộc chi nhánh nào
-- ⇒ chỉ người không bị giới hạn. Áp cho MỌI vai trò khác OWNER (trước đây chỉ 'staff').
CREATE OR REPLACE FUNCTION public.owner_ws_branch_ok(p_workspace_id UUID, p_branch_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT r.is_system OR m.branch_scope IS NULL OR p_branch_id = ANY (m.branch_scope)
      FROM public.asset_owner_workspace_members m
      JOIN public.owner_ws_roles r ON r.id = m.role_id AND r.workspace_id = m.workspace_id
     WHERE m.workspace_id = p_workspace_id
       AND m.user_id = auth.uid()
       AND m.status = 'active'
  ), false)
$$;

CREATE FUNCTION public.owner_ws_has_in(p_workspace_id UUID, p_module TEXT, p_action TEXT, p_branch_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.owner_ws_has(p_workspace_id, p_module, p_action)
     AND public.owner_ws_branch_ok(p_workspace_id, p_branch_id)
$$;

-- Vai trò p_role_id có nằm trong quyền của p_user_id không (luật chống leo quyền).
-- Người dùng là Trưởng đơn vị ⇒ luôn true; vai trò OWNER ⇒ chỉ Trưởng đơn vị.
CREATE FUNCTION public.owner_ws_role_within_user(p_role_id UUID, p_user_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE
             WHEN public.owner_ws_user_is_owner(r.workspace_id, p_user_id) THEN true
             WHEN r.is_system THEN false
             ELSE NOT EXISTS (
               SELECT 1 FROM public.owner_ws_role_permissions p
                WHERE p.role_id = r.id
                  AND NOT public.owner_ws_user_has(r.workspace_id, p_user_id, p.module, p.action))
           END
      FROM public.owner_ws_roles r
     WHERE r.id = p_role_id
  ), false)
$$;

-- Phạm vi chi nhánh p_scope (NULL = toàn Trạm) có nằm trong phạm vi của p_user_id không.
CREATE FUNCTION public.owner_ws_scope_within_user(p_workspace_id UUID, p_user_id UUID, p_scope UUID[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT r.is_system OR m.branch_scope IS NULL
           OR (p_scope IS NOT NULL AND p_scope <@ m.branch_scope)
      FROM public.asset_owner_workspace_members m
      JOIN public.owner_ws_roles r ON r.id = m.role_id AND r.workspace_id = m.workspace_id
     WHERE m.workspace_id = p_workspace_id
       AND m.user_id = p_user_id
       AND m.status = 'active'
  ), false)
$$;

-- ─── Trigger thành viên / lời mời / vai trò ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.owner_ws_members_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _new_owner     BOOLEAN := public.owner_ws_role_is_owner(NEW.role_id);
  _old_owner     BOOLEAN := false;
  _touches_owner BOOLEAN;
  _bootstrap     BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    _old_owner := public.owner_ws_role_is_owner(OLD.role_id);
    IF NEW.workspace_id <> OLD.workspace_id OR NEW.user_id <> OLD.user_id THEN
      RAISE EXCEPTION 'Không thể chuyển thành viên sang không gian hoặc người dùng khác';
    END IF;
  END IF;

  -- Chỉ kiểm khi phạm vi đổi: chi nhánh bị xoá sau này để lại id "chết" vô hại,
  -- không được chặn các thay đổi khác của dòng.
  IF NEW.branch_scope IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.branch_scope IS DISTINCT FROM OLD.branch_scope)
     AND EXISTS (
       SELECT 1 FROM unnest(NEW.branch_scope) AS b(id)
        WHERE NOT EXISTS (
          SELECT 1 FROM public.workspace_branches wb
           WHERE wb.id = b.id AND wb.workspace_id = NEW.workspace_id
        )
     ) THEN
    RAISE EXCEPTION 'Phạm vi có chi nhánh không thuộc không gian này';
  END IF;

  IF _new_owner AND NEW.branch_scope IS NOT NULL THEN
    RAISE EXCEPTION 'Trưởng đơn vị luôn quản lý toàn bộ không gian (không giới hạn chi nhánh)'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'active' AND NEW.joined_at IS NULL THEN
    NEW.joined_at := now();
  END IF;

  -- Trao / thu hồi vai trò Trưởng đơn vị (kể cả đổi trạng thái của một dòng Trưởng đơn vị).
  IF TG_OP = 'INSERT' THEN
    _touches_owner := _new_owner;
  ELSE
    _touches_owner := (_old_owner OR _new_owner)
                      AND (NEW.role_id IS DISTINCT FROM OLD.role_id OR NEW.status IS DISTINCT FROM OLD.status);
  END IF;

  -- auth.uid() NULL = migration / service_role ⇒ cho qua.
  IF _touches_owner
     AND auth.uid() IS NOT NULL
     AND NOT public.owner_ws_is_owner(NEW.workspace_id) THEN
    -- Khởi tạo: dòng Trưởng đơn vị đầu tiên cho người tạo không gian (trigger tạo
    -- workspace chạy dưới danh nghĩa admin duyệt KYC — admin không phải thành viên).
    _bootstrap := TG_OP = 'INSERT'
      AND NEW.status = 'active'
      AND NEW.user_id = (SELECT w.owner_user_id FROM public.asset_owner_workspaces w
                          WHERE w.id = NEW.workspace_id)
      AND NOT EXISTS (
        SELECT 1
          FROM public.asset_owner_workspace_members m
          JOIN public.owner_ws_roles r ON r.id = m.role_id
         WHERE m.workspace_id = NEW.workspace_id AND r.is_system AND m.status = 'active'
      );
    IF NOT COALESCE(_bootstrap, false) THEN
      RAISE EXCEPTION 'Chỉ Trưởng đơn vị mới được trao hoặc thu hồi vai trò Trưởng đơn vị';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_ws_protect_last_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _others INT;
BEGIN
  -- Không phải Trưởng đơn vị đang hoạt động ⇒ không liên quan.
  IF NOT public.owner_ws_role_is_owner(OLD.role_id) OR OLD.status <> 'active' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- UPDATE không đụng vai trò lẫn trạng thái ⇒ bỏ qua.
  IF TG_OP = 'UPDATE' AND NEW.role_id IS NOT DISTINCT FROM OLD.role_id AND NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Xoá dây chuyền (xoá không gian / xoá người dùng): dòng cha đã biến mất
  -- ⇒ cho qua, nếu không ON DELETE CASCADE sẽ chặn cả việc xoá cha.
  IF TG_OP = 'DELETE' AND (
       NOT EXISTS (SELECT 1 FROM public.asset_owner_workspaces w WHERE w.id = OLD.workspace_id)
    OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = OLD.user_id)
  ) THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO _others
    FROM public.asset_owner_workspace_members m
    JOIN public.owner_ws_roles r ON r.id = m.role_id
   WHERE m.workspace_id = OLD.workspace_id
     AND r.is_system
     AND m.status = 'active'
     AND m.id <> OLD.id;

  IF _others = 0 THEN
    RAISE EXCEPTION 'Không gian phải còn ít nhất một Trưởng đơn vị đang hoạt động';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- Lời mời: không bao giờ mời thẳng vào Trưởng đơn vị; phạm vi không được rỗng.
CREATE FUNCTION public.owner_ws_invites_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.owner_ws_role_is_owner(NEW.role_id) THEN
    RAISE EXCEPTION 'invalid_role: không mời thẳng vào vai trò Trưởng đơn vị' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER asset_owner_workspace_invites_guard
  BEFORE INSERT OR UPDATE OF role_id ON public.asset_owner_workspace_invites
  FOR EACH ROW EXECUTE FUNCTION public.owner_ws_invites_guard();

-- Phạm vi chi nhánh giờ dùng được cho mọi vai trò khác Trưởng đơn vị.
ALTER TABLE public.asset_owner_workspace_invites DROP CONSTRAINT aowi_scope_staff_only;
ALTER TABLE public.asset_owner_workspace_invites
  ADD CONSTRAINT aowi_branch_scope_not_empty CHECK (branch_scope IS NULL OR cardinality(branch_scope) > 0);

-- Vai trò: code / Trạm / is_system bất biến; OWNER không đổi tên, không xoá; vai trò
-- còn người dùng hoặc còn lời mời chưa dùng thì không xoá (FK SET NULL sẽ vi phạm CHECK).
CREATE FUNCTION public.owner_ws_roles_protect()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.workspace_id <> OLD.workspace_id OR NEW.code <> OLD.code OR NEW.is_system <> OLD.is_system THEN
      RAISE EXCEPTION 'system_role: không đổi được mã, Trạm hay loại của vai trò' USING ERRCODE = '23514';
    END IF;
    IF OLD.is_system AND auth.uid() IS NOT NULL
       AND (NEW.name IS DISTINCT FROM OLD.name OR NEW.description IS DISTINCT FROM OLD.description) THEN
      RAISE EXCEPTION 'system_role: vai trò Trưởng đơn vị không sửa được' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  -- Xoá dây chuyền khi xoá cả Trạm ⇒ cho qua.
  IF NOT EXISTS (SELECT 1 FROM public.asset_owner_workspaces w WHERE w.id = OLD.workspace_id) THEN
    RETURN OLD;
  END IF;
  IF OLD.is_system THEN
    RAISE EXCEPTION 'system_role: không xoá được vai trò Trưởng đơn vị' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.asset_owner_workspace_members m
              WHERE m.role_id = OLD.id AND m.status <> 'removed')
     OR EXISTS (SELECT 1 FROM public.asset_owner_workspace_invites i
                 WHERE i.role_id = OLD.id AND i.accepted_at IS NULL AND i.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'role_in_use: vai trò đang được gán hoặc còn lời mời' USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER owner_ws_roles_protect
  BEFORE UPDATE OR DELETE ON public.owner_ws_roles
  FOR EACH ROW EXECUTE FUNCTION public.owner_ws_roles_protect();

-- ─── Wrapper theo module ────────────────────────────────────────────────────

-- Hồ sơ số hoá. Bản 4 tham số cũ CHỈ còn 'read'.
CREATE OR REPLACE FUNCTION public.owner_posting_row_can(p_workspace_id UUID, p_branch_id UUID, p_user_id UUID, p_action TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    CASE
      WHEN p_action <> 'read'     THEN public.owner_ws_legacy_action(p_action)
      WHEN p_workspace_id IS NULL THEN p_user_id = auth.uid()
      ELSE public.owner_ws_can(p_workspace_id, 'read')
    END,
    false)
$$;

-- Hồ sơ cá nhân (workspace NULL) ⇒ chỉ người tạo; hồ sơ của Trạm ⇒ quyền module + chi nhánh.
CREATE FUNCTION public.owner_posting_row_can(p_workspace_id UUID, p_branch_id UUID, p_user_id UUID, p_module TEXT, p_action TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    CASE
      WHEN p_workspace_id IS NULL THEN p_user_id = auth.uid()
      ELSE public.owner_ws_has_in(p_workspace_id, p_module, p_action, p_branch_id)
    END,
    false)
$$;

CREATE FUNCTION public.owner_posting_can(p_posting_id UUID, p_module TEXT, p_action TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT public.owner_posting_row_can(p.workspace_id, p.branch_id, p.user_id, p_module, p_action)
      FROM public.asset_postings p
     WHERE p.id = p_posting_id), false)
$$;

CREATE OR REPLACE FUNCTION public.sale_owner_seller_can(p_consignment_contract_id UUID, p_seller_user_id UUID, p_action TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT CASE p_action
              WHEN 'read'  THEN public.owner_posting_can(c.asset_posting_id, 'read')
              -- Hàm riêng của hợp đồng mua bán ⇒ 'write' ở đây LUÔN là hop-dong-mua-ban:update.
              WHEN 'write' THEN public.owner_posting_can(c.asset_posting_id, 'hop-dong-mua-ban', 'update')
              ELSE false
            END
       FROM public.consignment_contracts c
      WHERE c.id = p_consignment_contract_id),
    p_seller_user_id = auth.uid(),
    false)
$$;

CREATE OR REPLACE FUNCTION public.owner_ws_claim_write_ok(p_workspace_id UUID, p_asset_owner_id UUID)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.owner_ws_has(p_workspace_id, 'tai-san', 'update')
     AND public.owner_ws_branch_ok(
           p_workspace_id,
           (SELECT wb.id
              FROM public.workspace_branches wb
             WHERE wb.workspace_id = p_workspace_id
               AND wb.asset_owner_id = p_asset_owner_id)
         )
$$;

-- Sổ thu chi: 'read' | 'create' | 'update' | 'delete' (module thu-tien + chi nhánh của kết quả).
CREATE OR REPLACE FUNCTION public.owner_cash_event_ok(p_outcome_id UUID, p_action TEXT)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE
             WHEN p_action = 'read' THEN public.owner_ws_can(o.workspace_id, 'read')
             WHEN p_action IN ('create', 'update', 'delete')
               THEN public.owner_ws_has_in(o.workspace_id, 'thu-tien', p_action, o.branch_id)
             ELSE false
           END
      FROM public.owner_asset_outcomes o
     WHERE o.id = p_outcome_id
  ), false)
$$;

-- Biên bản của kết quả tự khai: 'read' | 'upload' (ket-qua:update) | 'remove'
-- (ket-qua:update hoặc :delete — xoá kết quả phải xoá được tệp của nó trước).
CREATE OR REPLACE FUNCTION public.owner_outcome_evidence_ok(_name TEXT, _action TEXT)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws      UUID;
  v_outcome UUID;
  v_branch  UUID;
BEGIN
  BEGIN
    v_ws      := split_part(_name, '/', 1)::uuid;
    v_outcome := split_part(_name, '/', 2)::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;

  SELECT o.branch_id INTO v_branch
    FROM public.owner_asset_outcomes o
   WHERE o.id = v_outcome AND o.workspace_id = v_ws;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF _action = 'read' THEN
    RETURN public.owner_ws_can(v_ws, 'read');
  ELSIF _action = 'upload' THEN
    RETURN public.owner_ws_has_in(v_ws, 'ket-qua', 'update', v_branch);
  ELSIF _action = 'remove' THEN
    RETURN public.owner_ws_has_in(v_ws, 'ket-qua', 'update', v_branch)
        OR public.owner_ws_has_in(v_ws, 'ket-qua', 'delete', v_branch);
  END IF;
  RETURN false;
END;
$$;

-- ─── Các hàm chỉ đổi đúng biểu thức kiểm quyền (sinh từ pg_get_functiondef live) ──

CREATE OR REPLACE FUNCTION public.start_asset_3d_scan(_posting_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid        UUID := auth.uid();
  v_posting    public.asset_postings%ROWTYPE;
  v_scan       public.asset_3d_scans%ROWTYPE;
  v_variant_id UUID;
  v_cost       INTEGER;
  v_tx_id      UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- FOR UPDATE tuần tự hoá hai lần bấm đồng thời trên cùng hồ sơ ⇒ không trừ credit
  -- hai lần. Khoá dòng không kích hoạt trigger UPDATE nên review guard không liên quan.
  SELECT * INTO v_posting
    FROM public.asset_postings
   WHERE id = _posting_id AND public.owner_posting_can(id, 'so-hoa', 'update')
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_posting.status IN ('cancelled', 'contracted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_closed');
  END IF;

  PERFORM public._asset_3d_expire_stale(_posting_id);

  -- Đang có phiên quét chạy ⇒ trả lại phiên đó, không trừ thêm.
  SELECT * INTO v_scan
    FROM public.asset_3d_scans
   WHERE asset_posting_id = _posting_id AND status IN ('awaiting_scan', 'processing');
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'reused', true, 'scan_id', v_scan.id,
                              'scan_token', v_scan.scan_token, 'lot_id', _posting_id, 'cost', 0);
  END IF;

  SELECT v.id, v.credit_cost INTO v_variant_id, v_cost
    FROM public.service_variants v
   WHERE v.variant_key = 'scan_3d_owner' AND v.is_active;
  IF v_variant_id IS NULL OR v_cost IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'service_unavailable');
  END IF;

  IF v_cost > 0 THEN
    UPDATE public.user_credits
       SET balance = balance - v_cost, updated_at = now()
     WHERE user_id = v_uid AND balance >= v_cost;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'cost', v_cost);
    END IF;

    INSERT INTO public.credit_transactions
      (user_id, type, description, credit_delta, variant_key, service_variant_id)
    VALUES (v_uid, 'scan_3d', 'Quét 3D tài sản — ' || left(v_posting.title, 80),
            -v_cost, 'scan_3d_owner', v_variant_id)
    RETURNING id INTO v_tx_id;
  END IF;

  INSERT INTO public.asset_3d_scans
    (asset_posting_id, user_id, partner, scan_token, credit_cost, credit_transaction_id)
  VALUES (_posting_id, v_uid, 'mock',
          replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
          v_cost, v_tx_id)
  RETURNING * INTO v_scan;

  RETURN jsonb_build_object('ok', true, 'reused', false, 'scan_id', v_scan.id,
                            'scan_token', v_scan.scan_token, 'lot_id', _posting_id, 'cost', v_cost);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mock_partner_deliver_asset_3d_scan(_scan_id uuid, _lot_id uuid, _token text, _outcome text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_scan public.asset_3d_scans%ROWTYPE;
  v_job  TEXT;
  -- File mẫu CC0 (Khronos glTF Sample Assets — SheenChair), tải lên bucket asset-3d.
  c_base CONSTANT TEXT := 'https://vewtnkewyawmkpeymdot.supabase.co/storage/v1/object/public/asset-3d/samples/';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_scan FROM public.asset_3d_scans WHERE id = _scan_id;
  IF NOT FOUND OR NOT public.owner_posting_can(v_scan.asset_posting_id, 'so-hoa', 'update') OR v_scan.partner <> 'mock' OR v_scan.scan_token <> _token THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'scan_not_found');
  END IF;

  v_job := 'mock-' || _scan_id::text;

  IF _outcome = 'processing' THEN
    RETURN public.mark_asset_3d_processing(_scan_id, _lot_id, v_job);
  ELSIF _outcome = 'ready' THEN
    RETURN public.attach_asset_3d_model(_scan_id, _lot_id, v_job,
                                        c_base || 'sheen-chair.glb', c_base || 'sheen-chair.jpg', 'glb');
  ELSIF _outcome = 'failed' THEN
    RETURN public.fail_asset_3d_scan(_scan_id, _lot_id, v_job, 'Ảnh quét thiếu góc — vui lòng quét lại');
  END IF;

  RETURN jsonb_build_object('ok', false, 'reason', 'invalid_outcome');
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_request_vr_tour(_posting_id uuid, _variant_key text, _supplier_id uuid, _site_address text, _preferred_time text, _note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     UUID := auth.uid();
  v_posting public.asset_postings%ROWTYPE;
  v_svc     UUID := public._vr_tour_service_id();
  v_var     public.service_variants%ROWTYPE;
  v_partner TEXT;
  v_active  public.asset_vr_tour_orders%ROWTYPE;
  v_order   public.asset_vr_tour_orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- Khoá dòng tuần tự hoá hai lần bấm; khoá không bắn trigger UPDATE (review guard).
  SELECT * INTO v_posting FROM public.asset_postings
   WHERE id = _posting_id AND public.owner_posting_can(id, 'so-hoa', 'update') FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_posting.status IN ('cancelled', 'contracted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_closed');
  END IF;

  SELECT v.* INTO v_var FROM public.service_variants v
   WHERE v.variant_key = _variant_key AND v.service_id = v_svc AND v.is_active;
  IF NOT FOUND OR v_svc IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'package_unavailable');
  END IF;

  SELECT sp.name INTO v_partner FROM public.suppliers sp
   WHERE sp.id = _supplier_id AND sp.status = 'active'
     AND EXISTS (SELECT 1 FROM public.resolve_contract_terms(sp.id, v_svc, v_var.id, CURRENT_DATE));
  IF v_partner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'partner_unavailable');
  END IF;

  SELECT * INTO v_active FROM public.asset_vr_tour_orders
   WHERE asset_posting_id = _posting_id
     AND status IN ('requested', 'quoted', 'paid', 'scheduled', 'delivered');
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_active', 'order_id', v_active.id);
  END IF;

  INSERT INTO public.asset_vr_tour_orders
    (asset_posting_id, user_id, service_variant_id, supplier_id, posting_title, package_name, partner_name,
     site_address, preferred_time, request_note)
  VALUES
    (_posting_id, v_uid, v_var.id, _supplier_id,
     COALESCE(NULLIF(btrim(v_posting.title), ''), 'Hồ sơ chưa đặt tên'), v_var.name, v_partner,
     NULLIF(btrim(_site_address), ''), NULLIF(btrim(_preferred_time), ''), NULLIF(btrim(_note), ''))
  RETURNING * INTO v_order;

  RETURN jsonb_build_object('ok', true, 'order_id', v_order.id, 'code', v_order.code);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_cancel_vr_tour(_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.asset_vr_tour_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO v_order FROM public.asset_vr_tour_orders
   WHERE id = _order_id AND public.owner_posting_can(asset_posting_id, 'so-hoa', 'update') FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_order.status NOT IN ('requested', 'quoted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_order.status);
  END IF;

  UPDATE public.asset_vr_tour_orders
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = 'Người bán huỷ yêu cầu'
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_request_authentication(_posting_id uuid, _method text, _supplier_id uuid, _site_address text, _preferred_time text, _note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     UUID := auth.uid();
  v_posting public.asset_postings%ROWTYPE;
  v_svc     UUID := public._authentication_service_id();
  v_var     public.service_variants%ROWTYPE;
  v_partner TEXT;
  v_active  UUID;
  v_order   public.asset_authentication_orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF _method NOT IN ('from_photos', 'ship_item', 'on_site') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'package_unavailable');
  END IF;
  IF _method = 'on_site' AND length(btrim(COALESCE(_site_address, ''))) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'address_required');
  END IF;

  SELECT * INTO v_posting FROM public.asset_postings
   WHERE id = _posting_id AND public.owner_posting_can(id, 'so-hoa', 'update') FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_posting.status IN ('cancelled', 'contracted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_closed');
  END IF;

  SELECT v.* INTO v_var FROM public.service_variants v
   WHERE v.variant_key = 'gd_' || _method AND v.service_id = v_svc AND v.is_active;
  IF NOT FOUND OR v_svc IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'package_unavailable');
  END IF;

  SELECT sp.name INTO v_partner FROM public.suppliers sp
   WHERE sp.id = _supplier_id AND sp.status = 'active'
     AND EXISTS (SELECT 1 FROM public.resolve_contract_terms(sp.id, v_svc, v_var.id, CURRENT_DATE));
  IF v_partner IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'partner_unavailable');
  END IF;

  SELECT id INTO v_active FROM public.asset_authentication_orders
   WHERE asset_posting_id = _posting_id
     AND status IN ('requested', 'quoted', 'paid', 'item_pending', 'in_review');
  IF v_active IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_active', 'order_id', v_active);
  END IF;

  INSERT INTO public.asset_authentication_orders
    (asset_posting_id, user_id, method, service_variant_id, supplier_id, posting_title, package_name,
     partner_name, site_address, preferred_time, request_note)
  VALUES
    (_posting_id, v_uid, _method, v_var.id, _supplier_id,
     COALESCE(NULLIF(btrim(v_posting.title), ''), 'Hồ sơ chưa đặt tên'), v_var.name, v_partner,
     NULLIF(btrim(_site_address), ''), NULLIF(btrim(_preferred_time), ''), NULLIF(btrim(_note), ''))
  RETURNING * INTO v_order;

  RETURN jsonb_build_object('ok', true, 'order_id', v_order.id, 'code', v_order.code);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_cancel_authentication(_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.asset_authentication_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO v_order FROM public.asset_authentication_orders
   WHERE id = _order_id AND public.owner_posting_can(asset_posting_id, 'so-hoa', 'update') FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_order.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_order.status NOT IN ('requested', 'quoted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_order.status);
  END IF;

  UPDATE public.asset_authentication_orders
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = 'Người bán huỷ yêu cầu'
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_submit_authentication_shipment(_order_id uuid, _tracking text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order public.asset_authentication_orders%ROWTYPE;
  v_trk   TEXT := btrim(COALESCE(_tracking, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO v_order FROM public.asset_authentication_orders
   WHERE id = _order_id AND public.owner_posting_can(asset_posting_id, 'so-hoa', 'update') FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_order.method <> 'ship_item' OR v_order.status NOT IN ('paid', 'item_pending') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_order.status);
  END IF;
  IF length(v_trk) < 4 OR length(v_trk) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'tracking_required');
  END IF;

  UPDATE public.asset_authentication_orders
     SET status = 'item_pending', shipment_tracking = v_trk, shipped_at = now()
   WHERE id = _order_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_request_legal_consult(_posting_id uuid, _doc_paths text[], _note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     UUID := auth.uid();
  v_posting public.asset_postings%ROWTYPE;
  v_var     public.service_variants%ROWTYPE;
  v_docs    TEXT[];
  v_active  UUID;
  v_row     public.asset_legal_consultations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_posting FROM public.asset_postings
   WHERE id = _posting_id AND public.owner_posting_can(id, 'so-hoa', 'update') FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_posting.status IN ('cancelled', 'contracted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_closed');
  END IF;

  SELECT v.* INTO v_var FROM public.service_variants v
   WHERE v.variant_key = 'tvpl_review' AND v.service_id = public._legal_consult_service_id() AND v.is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'package_unavailable');
  END IF;

  SELECT COALESCE(array_agg(DISTINCT btrim(p)), '{}') INTO v_docs
    FROM unnest(COALESCE(_doc_paths, '{}')) AS p WHERE btrim(p) <> '';
  IF cardinality(v_docs) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'docs_required');
  END IF;
  IF cardinality(v_docs) > 50 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'too_many_docs');
  END IF;
  -- Tệp CỦA MÌNH hoặc tệp đã gắn trên hồ sơ (đồng nghiệp tải lên), và phải
  -- thực sự nằm trong bucket private asset-docs.
  IF EXISTS (SELECT 1 FROM unnest(v_docs) AS p
              WHERE (p NOT LIKE v_uid::text || '/%'
                     AND NOT p = ANY (COALESCE(v_posting.ownership_proof_urls, '{}')
                                      || COALESCE(v_posting.doc_urls, '{}')))
                 OR NOT EXISTS (SELECT 1 FROM storage.objects o
                                 WHERE o.bucket_id = 'asset-docs' AND o.name = p)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'doc_invalid');
  END IF;

  SELECT id INTO v_active FROM public.asset_legal_consultations
   WHERE asset_posting_id = _posting_id AND status IN ('requested', 'quoted', 'paid', 'in_review');
  IF v_active IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_active', 'consultation_id', v_active);
  END IF;

  INSERT INTO public.asset_legal_consultations
    (asset_posting_id, user_id, service_variant_id, posting_title, parent_slug, package_name,
     submitted_doc_paths, request_note)
  VALUES
    (_posting_id, v_uid, v_var.id,
     COALESCE(NULLIF(btrim(v_posting.title), ''), 'Hồ sơ chưa đặt tên'), v_posting.parent_slug, v_var.name,
     v_docs, left(NULLIF(btrim(_note), ''), 2000))
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'consultation_id', v_row.id, 'code', v_row.code);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_cancel_legal_consult(_consultation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.asset_legal_consultations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO v_row FROM public.asset_legal_consultations
   WHERE id = _consultation_id AND public.owner_posting_can(asset_posting_id, 'so-hoa', 'update') FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_row.status NOT IN ('requested', 'quoted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;

  UPDATE public.asset_legal_consultations
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = 'Người bán huỷ yêu cầu'
   WHERE id = _consultation_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_request_auction_consult(_posting_id uuid, _sale_goal text, _expected_price numeric, _min_price numeric, _timeline text, _deadline date, _note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     UUID := auth.uid();
  v_posting public.asset_postings%ROWTYPE;
  v_var     public.service_variants%ROWTYPE;
  v_active  UUID;
  v_row     public.asset_auction_consultations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_posting FROM public.asset_postings
   WHERE id = _posting_id AND public.owner_posting_can(id, 'so-hoa', 'update') FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_posting.status IN ('cancelled', 'contracted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'posting_closed');
  END IF;

  SELECT v.* INTO v_var FROM public.service_variants v
   WHERE v.variant_key = 'tvdg_plan' AND v.service_id = public._auction_consult_service_id() AND v.is_active;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'package_unavailable');
  END IF;

  IF _sale_goal IS NULL OR _sale_goal NOT IN ('fastest', 'max_price', 'balanced') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_goal');
  END IF;
  IF (_expected_price IS NOT NULL AND (_expected_price <= 0 OR _expected_price <> round(_expected_price)))
     OR (_min_price IS NOT NULL AND (_min_price <= 0 OR _min_price <> round(_min_price))) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_price');
  END IF;
  IF _min_price IS NOT NULL AND _expected_price IS NOT NULL AND _min_price > _expected_price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'min_above_expected');
  END IF;
  IF _timeline IS NOT NULL AND _timeline NOT IN ('urgent', 'normal', 'flexible') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_timeline');
  END IF;
  IF _deadline IS NOT NULL AND (_deadline < CURRENT_DATE OR _deadline > CURRENT_DATE + 730) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_deadline');
  END IF;

  SELECT id INTO v_active FROM public.asset_auction_consultations
   WHERE asset_posting_id = _posting_id AND status IN ('requested', 'quoted', 'paid', 'in_review');
  IF v_active IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_active', 'consultation_id', v_active);
  END IF;

  -- BR-CNS-04: chỉ ĐỌC hồ sơ để chụp; không ghi asset_postings.
  INSERT INTO public.asset_auction_consultations
    (asset_posting_id, user_id, service_variant_id, package_name,
     posting_title, parent_slug, child_slug, province, posting_pricing_mode,
     posting_starting_price, posting_auction_format, posting_expected_timeline,
     sale_goal, expected_price, min_acceptable_price, desired_timeline, sale_deadline, request_note)
  VALUES
    (_posting_id, v_uid, v_var.id, v_var.name,
     COALESCE(NULLIF(btrim(v_posting.title), ''), 'Hồ sơ chưa đặt tên'), v_posting.parent_slug,
     v_posting.child_slug, v_posting.province, v_posting.pricing_mode,
     v_posting.starting_price, v_posting.auction_format, v_posting.expected_timeline,
     _sale_goal, _expected_price, _min_price, _timeline, _deadline, left(NULLIF(btrim(_note), ''), 2000))
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'consultation_id', v_row.id, 'code', v_row.code);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_cancel_auction_consult(_consultation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.asset_auction_consultations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO v_row FROM public.asset_auction_consultations
   WHERE id = _consultation_id AND public.owner_posting_can(asset_posting_id, 'so-hoa', 'update') FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_row.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;
  IF v_row.status NOT IN ('requested', 'quoted') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;

  UPDATE public.asset_auction_consultations
     SET status = 'cancelled', cancelled_at = now(), cancelled_by = auth.uid(),
         cancel_reason = 'Người bán huỷ yêu cầu'
   WHERE id = _consultation_id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_decide_auction_consult(_consultation_id uuid, _decision text, _note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row  public.asset_auction_consultations%ROWTYPE;
  v_note TEXT := left(NULLIF(btrim(COALESCE(_note, '')), ''), 1000);
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO v_row FROM public.asset_auction_consultations
   WHERE id = _consultation_id AND public.owner_posting_can(asset_posting_id, 'so-hoa', 'update') FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF _decision IS NULL OR _decision NOT IN ('accepted', 'declined') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_decision');
  END IF;
  IF v_row.status <> 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', v_row.status);
  END IF;
  IF v_row.seller_decision = _decision AND v_row.decision_note IS NOT DISTINCT FROM v_note THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true);
  END IF;

  UPDATE public.asset_auction_consultations
     SET seller_decision = _decision, decided_at = now(), decision_note = v_note
   WHERE id = _consultation_id;
  RETURN jsonb_build_object('ok', true, 'decision', _decision);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_accept_service_contract(_kind text, _order_id uuid, _template_id uuid, _expected_price numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      UUID := auth.uid();
  o          RECORD;
  v_tpl      public.contract_templates%ROWTYPE;
  v_existing public.service_contracts%ROWTYPE;
  v_owner    JSONB;
  v_provider JSONB;
  v_terms    JSONB;
  v_row      public.service_contracts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF public.service_kind_admin_module(_kind) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  END IF;

  -- Khoá dòng đơn: admin không báo giá lại xen giữa lúc đang chụp điều khoản.
  IF _kind = 'vr-tour' THEN
    PERFORM 1 FROM public.asset_vr_tour_orders WHERE id = _order_id FOR UPDATE;
  ELSIF _kind = 'giam-dinh' THEN
    PERFORM 1 FROM public.asset_authentication_orders WHERE id = _order_id FOR UPDATE;
  ELSIF _kind = 'tu-van-phap-ly' THEN
    PERFORM 1 FROM public.asset_legal_consultations WHERE id = _order_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.asset_auction_consultations WHERE id = _order_id FOR UPDATE;
  END IF;

  SELECT * INTO o FROM public._service_orders() s
   WHERE s.service_kind = _kind AND s.order_id = _order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF o.user_id <> v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_requester');
  END IF;
  IF NOT public.owner_posting_can(o.asset_posting_id, 'so-hoa', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  IF o.status <> 'quoted' OR o.quoted_price IS NULL OR o.quoted_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status', 'status', o.status);
  END IF;
  IF o.quote_expires_at IS NOT NULL AND o.quote_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quote_expired');
  END IF;
  IF _expected_price IS DISTINCT FROM o.quoted_price THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'quote_changed');
  END IF;

  -- Idempotent theo báo giá: bấm lại / hai tab ⇒ trả hợp đồng đã có.
  SELECT * INTO v_existing FROM public.service_contracts
   WHERE service_kind = _kind AND order_id = _order_id AND quoted_at = o.quoted_at
     AND price = o.quoted_price;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'status', 'already_accepted',
                              'contract_id', v_existing.id, 'code', v_existing.code);
  END IF;

  SELECT * INTO v_tpl FROM public.active_contract_template('service:' || _kind);
  IF v_tpl.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_template');
  END IF;
  IF v_tpl.id IS DISTINCT FROM _template_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'template_changed');
  END IF;

  SELECT public.consignment_posting_owner_party(o.asset_posting_id)
         || jsonb_build_object('signatory', jsonb_build_object(
              'user_id', v_uid, 'name', pr.name, 'email', pr.email))
    INTO v_owner
    FROM public.profiles pr WHERE pr.id = v_uid;

  v_provider := jsonb_build_object(
    'name', v_tpl.clauses ->> 'provider_name',
    'tax_code', v_tpl.clauses ->> 'provider_tax_code',
    'address', v_tpl.clauses ->> 'provider_address',
    'representative', v_tpl.clauses ->> 'provider_representative',
    'rep_title', v_tpl.clauses ->> 'provider_rep_title',
    'email', v_tpl.clauses ->> 'provider_email',
    'partner_name', o.partner_name,
    'expert_name', o.expert_name);

  v_terms := jsonb_build_object(
    'service_label', public.service_kind_label(_kind),
    'order_code', o.order_code,
    'package_name', o.package_name,
    'posting_title', o.posting_title,
    'price', o.quoted_price,
    'quote_note', o.quote_note,
    'quoted_at', o.quoted_at,
    'quote_expires_at', o.quote_expires_at,
    'extra', o.extra);

  INSERT INTO public.service_contracts (
    service_kind, order_id, order_code, asset_posting_id, quoted_at, price,
    template_id, template_version, owner_party, provider_party, terms, content_hash, accepted_by)
  VALUES (
    _kind, _order_id, o.order_code, o.asset_posting_id, o.quoted_at, o.quoted_price,
    v_tpl.id, v_tpl.version, COALESCE(v_owner, jsonb_build_object('kind', 'unknown')), v_provider, v_terms,
    encode(sha256(convert_to(jsonb_build_object(
      'template', v_tpl.version, 'clauses', v_tpl.clauses, 'terms', v_terms,
      'owner', v_owner, 'provider', v_provider)::text, 'UTF8')), 'hex'),
    v_uid)
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'status', 'accepted', 'contract_id', v_row.id, 'code', v_row.code);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_service_contracts(p_workspace_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(service_kind text, order_id uuid, order_code text, asset_posting_id uuid, posting_title text, package_name text, partner_name text, order_status text, quoted_price numeric, quoted_at timestamp with time zone, quote_expires_at timestamp with time zone, paid_at timestamp with time zone, done_at timestamp with time zone, cancelled_at timestamp with time zone, contract_id uuid, contract_code text, accepted_at timestamp with time zone, needs_acceptance boolean, can_accept boolean, legacy boolean, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH o AS (
    SELECT s.*, p.workspace_id, p.branch_id, p.user_id AS posting_user_id
      FROM public._service_orders() s
      JOIN public.asset_postings p ON p.id = s.asset_posting_id
     WHERE s.quoted_at IS NOT NULL
       AND CASE
             WHEN p_workspace_id IS NULL
               THEN p.workspace_id IS NULL AND p.user_id = auth.uid()
             ELSE p.workspace_id = p_workspace_id AND public.owner_ws_can(p_workspace_id, 'read')
           END
  ), j AS (
    SELECT o.*, sc.id AS sc_id, sc.code AS sc_code, sc.accepted_at AS sc_accepted_at,
           (o.status = 'quoted'
            AND (o.quote_expires_at IS NULL OR o.quote_expires_at >= now())) AS open_quote
      FROM o
      LEFT JOIN public.service_contracts sc
        ON sc.service_kind = o.service_kind AND sc.order_id = o.order_id
       AND sc.quoted_at = o.quoted_at AND sc.price = o.quoted_price
  )
  SELECT j.service_kind, j.order_id, j.order_code, j.asset_posting_id, j.posting_title, j.package_name,
         j.partner_name, j.status, j.quoted_price, j.quoted_at, j.quote_expires_at, j.paid_at, j.done_at,
         j.cancelled_at, j.sc_id, j.sc_code, j.sc_accepted_at,
         (j.sc_id IS NULL AND j.open_quote),
         (j.sc_id IS NULL AND j.open_quote AND j.user_id = auth.uid()
          AND public.owner_posting_row_can(j.workspace_id, j.branch_id, j.posting_user_id, 'so-hoa', 'update')),
         (j.sc_id IS NULL AND j.paid_at IS NOT NULL),
         j.created_at
    FROM j
   WHERE j.sc_id IS NOT NULL OR j.open_quote OR j.paid_at IS NOT NULL
   ORDER BY COALESCE(j.sc_accepted_at, j.quoted_at) DESC
$function$;

CREATE OR REPLACE FUNCTION public.owner_select_service_quote(_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid         UUID := auth.uid();
  v_posting_id  UUID;
  v_req         public.asset_service_requests%ROWTYPE;
  v_posting     public.asset_postings%ROWTYPE;
  v_org         public.auction_organizations%ROWTYPE;
  v_org_account UUID;
  v_contract    UUID;
  v_prof        RECORD;
  v_service     UUID;
  v_variant     UUID;
  v_lead        UUID;
  v_opp         UUID;
  v_supplier    UUID;
  v_terms       RECORD;
  v_ctype       TEXT    := NULL;
  v_cvalue      NUMERIC := NULL;
  v_cid         UUID    := NULL;
  v_lineid      UUID    := NULL;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT asset_posting_id INTO v_posting_id
    FROM public.asset_service_requests
   WHERE id = _request_id AND public.owner_posting_can(asset_posting_id, 'ky-gui', 'update');
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  PERFORM public.lock_asset_posting_consignment(v_posting_id);

  SELECT * INTO v_req FROM public.asset_service_requests WHERE id = _request_id FOR UPDATE;

  IF public.asset_posting_selection_locked(v_req.asset_posting_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_selected');
  END IF;
  IF v_req.status <> 'quoted' OR v_req.quoted_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_quoted');
  END IF;

  -- Hợp đồng cần tài khoản tổ chức (người soạn / ký). Báo giá chỉ gửi được từ
  -- tài khoản nên thiếu ở đây là dữ liệu hỏng, không phải lỗi người dùng.
  v_org_account := COALESCE(v_req.organization_id, (
    SELECT o.id FROM public.organizations o
     WHERE o.auction_org_id = v_req.auction_org_id AND o.kyc_status = 'APPROVED'
     ORDER BY o.created_at LIMIT 1
  ));
  IF v_org_account IS NULL THEN
    RAISE EXCEPTION 'Tổ chức chưa có tài khoản trên sàn — không lập được hợp đồng'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO v_posting FROM public.asset_postings WHERE id = v_req.asset_posting_id;
  SELECT * INTO v_org     FROM public.auction_organizations WHERE id = v_req.auction_org_id;

  UPDATE public.asset_service_requests SET status = 'selected' WHERE id = _request_id;

  UPDATE public.asset_service_requests
     SET status_before_close  = status,
         closed_by_request_id = _request_id,
         status               = 'not_selected'
   WHERE asset_posting_id = v_req.asset_posting_id
     AND id <> _request_id
     AND status IN ('sent', 'seen', 'quoted');

  UPDATE public.asset_broker_requests
     SET status = 'selected', selected_request_id = _request_id
   WHERE asset_posting_id = v_req.asset_posting_id AND status <> 'cancelled';

  -- ⚠️ KHÔNG đụng vào asset_postings — guard_asset_posting_review() nuốt thay đổi
  -- của mọi caller thiếu quyền, KỂ CẢ hàm SECURITY DEFINER này.

  INSERT INTO public.consignment_contracts
    (service_request_id, asset_posting_id, auction_org_id, organization_id, owner_user_id,
     terms, owner_party, org_party, asset_snapshot)
  VALUES
    (_request_id, v_req.asset_posting_id, v_req.auction_org_id, v_org_account, v_uid,
     public.consignment_request_terms(v_req),
     public.consignment_posting_owner_party(v_req.asset_posting_id),
     public.consignment_org_party(v_req.auction_org_id, v_org_account),
     public.consignment_asset_snapshot(v_req.asset_posting_id))
  RETURNING id INTO v_contract;

  INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data)
  VALUES (v_contract, 'created', 'owner', v_uid, jsonb_build_object('request_id', _request_id));

  SELECT o.id, o.lead_id INTO v_opp, v_lead
    FROM public.opportunities o
   WHERE o.asset_posting_id = v_req.asset_posting_id
     AND o.stage IN ('selling', 'pending_approval')
   LIMIT 1;
  IF v_opp IS NOT NULL THEN
    UPDATE public.consignment_contracts SET opportunity_id = v_opp WHERE id = v_contract;
    RETURN jsonb_build_object('ok', true, 'opportunity_id', v_opp, 'lead_id', v_lead, 'deduped', true,
                              'consignment_contract_id', v_contract);
  END IF;

  -- Tổ chức này đã có hồ sơ đối tác + hợp đồng đang hiệu lực chưa?
  SELECT id INTO v_supplier
    FROM public.suppliers
   WHERE auction_org_id = v_req.auction_org_id AND status = 'active'
   LIMIT 1;

  IF v_supplier IS NOT NULL THEN
    SELECT s.id INTO v_service
      FROM public.services s WHERE s.name = 'Hoa hồng môi giới ký gửi' LIMIT 1;
    SELECT sv.id INTO v_variant
      FROM public.service_variants sv WHERE sv.variant_key = 'broker_commission' LIMIT 1;

    IF v_service IS NOT NULL THEN
      SELECT * INTO v_terms
        FROM public.resolve_contract_terms(v_supplier, v_service, v_variant, CURRENT_DATE);
      IF FOUND THEN
        v_ctype  := v_terms.commission_type;
        v_cvalue := v_terms.commission_value;
        v_cid    := v_terms.contract_id;
        v_lineid := v_terms.line_id;
      ELSE
        v_service  := NULL;
        v_variant  := NULL;
        v_supplier := NULL;
      END IF;
    ELSE
      v_supplier := NULL;
    END IF;
  END IF;

  IF v_service IS NULL THEN
    SELECT s.id INTO v_service FROM public.services s WHERE s.name = 'Môi giới ký gửi tài sản' LIMIT 1;
    SELECT sv.id INTO v_variant FROM public.service_variants sv WHERE sv.variant_key = 'broker_consignment' LIMIT 1;
  END IF;

  IF v_service IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'opportunity_id', NULL, 'lead_id', NULL, 'deduped', false,
                              'consignment_contract_id', v_contract);
  END IF;

  SELECT name, email INTO v_prof FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.leads
    (name, contact_name, phone, email, lead_type, source, status, note,
     created_by, asset_posting_id)
  VALUES (
    COALESCE(NULLIF(v_prof.name, ''), v_prof.email, 'Chủ tài sản'),
    v_prof.name, NULL, v_prof.email,
    'asset_owner', 'asset_brokerage', 'new',
    'Chốt ký gửi "' || v_posting.title || '" với ' || COALESCE(v_org.name, 'tổ chức đấu giá'),
    v_uid, v_req.asset_posting_id
  )
  RETURNING id INTO v_lead;

  INSERT INTO public.opportunities
    (name, lead_id, opportunity_type, stage, service_id, service_variant_id,
     amount, gross_amount, created_by, asset_posting_id,
     supplier_id, commission_type, commission_value, contract_id, contract_line_id)
  VALUES (
    'Ký gửi: ' || v_posting.title,
    v_lead, 'new_business', 'selling', v_service, v_variant,
    0, COALESCE(v_req.quote_service_fee, 0), v_uid, v_req.asset_posting_id,
    v_supplier, v_ctype, v_cvalue, v_cid, v_lineid
  )
  RETURNING id INTO v_opp;

  UPDATE public.consignment_contracts SET opportunity_id = v_opp WHERE id = v_contract;

  RETURN jsonb_build_object(
    'ok', true,
    'opportunity_id', v_opp, 'lead_id', v_lead, 'deduped', false,
    'contract_id', v_cid,
    'consignment_contract_id', v_contract
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_cancel_broker_request(_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.asset_broker_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO r FROM public.asset_broker_requests
   WHERE id = _request_id AND public.owner_posting_can(asset_posting_id, 'ky-gui', 'update')
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF r.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;
  UPDATE public.asset_broker_requests SET status = 'cancelled' WHERE id = r.id;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.consignment_contract_can_act(_contract_id uuid, _side text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT CASE
      WHEN auth.uid() IS NULL THEN false
      WHEN _side = 'owner'    THEN public.owner_posting_can(c.asset_posting_id, 'ky-gui', 'update')
      ELSE public.consignment_can_act(c.owner_user_id, c.auction_org_id, c.organization_id, _side)
    END
      FROM public.consignment_contracts c
     WHERE c.id = _contract_id), false)
$function$;

CREATE OR REPLACE FUNCTION public.owner_consignment_summary(p_workspace_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(posting_id uuid, quoted_count integer, has_selection boolean, contract_id uuid, contract_status text, owner_action text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT p.id,
           public.owner_posting_row_can(p.workspace_id, p.branch_id, p.user_id, 'ky-gui', 'update') AS can_write,
           (SELECT count(*)::int FROM public.asset_service_requests r
             WHERE r.asset_posting_id = p.id AND r.status = 'quoted') AS quoted_count,
           EXISTS (SELECT 1 FROM public.asset_service_requests r
                    WHERE r.asset_posting_id = p.id AND r.status IN ('selected', 'accepted')) AS has_selection,
           c.id AS contract_id,
           c.status AS contract_status,
           c.owner_confirmed_at
      FROM public.asset_postings p
      LEFT JOIN LATERAL (
        SELECT cc.id, cc.status, cc.owner_confirmed_at
          FROM public.consignment_contracts cc
         WHERE cc.asset_posting_id = p.id AND cc.status <> 'cancelled'
         LIMIT 1
      ) c ON true
     WHERE CASE
             WHEN p_workspace_id IS NULL
               THEN p.workspace_id IS NULL AND p.user_id = auth.uid()
             ELSE p.workspace_id = p_workspace_id AND public.owner_ws_can(p_workspace_id, 'read')
           END
  )
  SELECT b.id, b.quoted_count, b.has_selection, b.contract_id, b.contract_status,
         CASE
           WHEN NOT b.can_write THEN NULL
           WHEN b.contract_status = 'awaiting_confirmation' AND b.owner_confirmed_at IS NULL
             THEN 'confirm_contract'
           WHEN b.contract_status IN ('drafting', 'awaiting_signatures', 'awaiting_confirmation')
                AND btrim(COALESCE(public.consignment_posting_owner_party(b.id) ->> 'address', '')) = ''
             THEN 'add_address'
           WHEN NOT b.has_selection AND b.quoted_count > 0
             THEN 'choose_quote'
         END
    FROM base b;
$function$;

CREATE OR REPLACE FUNCTION public.owner_import_outcomes(p_workspace_id uuid, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row     JSONB;
  v_ord     BIGINT;
  v_listing UUID;
  v_id      UUID;
  v_out     JSONB := '[]'::jsonb;
  v_state   TEXT;
  v_msg     TEXT;
  v_con     TEXT;
BEGIN
  IF NOT public.owner_ws_has(p_workspace_id, 'ket-qua', 'update') THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'rows_must_be_array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_rows) > 500 THEN
    RAISE EXCEPTION 'too_many_rows' USING ERRCODE = '22023';
  END IF;

  FOR v_row, v_ord IN
    SELECT t.e, t.ord FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(e, ord)
  LOOP
    BEGIN
      v_listing := NULLIF(v_row->>'listing_id', '')::uuid;
      INSERT INTO public.owner_asset_outcomes (
        workspace_id, listing_id, asset_title, asset_category, branch_id,
        round_no, auction_date, auction_org_id, outcome, failure_reason,
        starting_price, winning_price, participants,
        source, evidence_urls, share_to_market, reported_by
      ) VALUES (
        p_workspace_id,
        v_listing,
        CASE WHEN v_listing IS NULL THEN v_row->>'asset_title' END,
        CASE WHEN v_listing IS NULL THEN NULLIF(v_row->>'asset_category', '') END,
        CASE WHEN v_listing IS NULL THEN NULLIF(v_row->>'branch_id', '')::uuid END,
        COALESCE(NULLIF(v_row->>'round_no', '')::int, 1),
        (v_row->>'auction_date')::date,
        NULLIF(v_row->>'auction_org_id', '')::uuid,
        v_row->>'outcome',
        NULLIF(v_row->>'failure_reason', ''),
        NULLIF(v_row->>'starting_price', '')::numeric,
        NULLIF(v_row->>'winning_price', '')::numeric,
        NULLIF(v_row->>'participants', '')::int,
        'owner_import', '{}', false, auth.uid()
      )
      RETURNING id INTO v_id;
      v_out := v_out || jsonb_build_array(jsonb_build_object('idx', v_ord - 1, 'ok', true, 'id', v_id));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT, v_con = CONSTRAINT_NAME;
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'idx', v_ord - 1, 'ok', false, 'code', v_state, 'message', v_msg,
        'constraint', NULLIF(v_con, '')));
    END;
  END LOOP;

  RETURN v_out;
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_outcome_resolve_conflict(p_workspace_id uuid, p_listing_id uuid, p_choice text, p_source_fp text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sources  JSONB;
  v_own      JSONB;
  v_platform JSONB;
  v_pick     JSONB;
  v_dismiss  JSONB;
  v_res      JSONB;
  v_n        INT;
  v_round    INT;
  v_id       UUID;
BEGIN
  IF NOT public.owner_ws_has(p_workspace_id, 'ket-qua', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;
  IF p_choice IS NULL OR p_choice NOT IN ('keep_mine', 'use_source') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_choice');
  END IF;

  SELECT r.sources INTO v_sources
    FROM public.owner_asset_outcomes_resolved(p_workspace_id) r
   WHERE r.listing_id = p_listing_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_in_portfolio');
  END IF;

  SELECT e INTO v_own FROM jsonb_array_elements(v_sources) e
   WHERE e->>'kind' = 'owner_report' AND (e->>'in_round')::boolean
   LIMIT 1;
  SELECT e INTO v_platform FROM jsonb_array_elements(v_sources) e
   WHERE e->>'kind' = 'platform' AND (e->>'in_round')::boolean
   LIMIT 1;

  IF p_choice = 'keep_mine' THEN
    IF v_own IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'no_own_record');
    END IF;
    IF v_platform IS NOT NULL AND public.owner_outcome_disagrees(
         v_own->>'outcome', (v_own->>'price')::numeric, (v_own->>'date')::date,
         v_platform->>'outcome', (v_platform->>'price')::numeric, (v_platform->>'date')::date) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'platform_disagrees');
    END IF;
    v_pick := v_own;
  ELSE
    SELECT e INTO v_pick FROM jsonb_array_elements(v_sources) e
     WHERE e->>'fp' = p_source_fp AND e->>'kind' <> 'owner_report'
     LIMIT 1;
    IF v_pick IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'source_changed');
    END IF;
    IF COALESCE(v_pick->>'outcome', '') NOT IN ('sold', 'unsold', 'postponed', 'cancelled', 'withdrawn') THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'bad_source');
    END IF;
    IF v_pick->>'outcome' = 'sold' AND v_pick->>'price' IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'source_has_no_price');
    END IF;
    IF v_pick->>'kind' <> 'platform' AND v_platform IS NOT NULL AND public.owner_outcome_disagrees(
         v_pick->>'outcome', (v_pick->>'price')::numeric, (v_pick->>'date')::date,
         v_platform->>'outcome', (v_platform->>'price')::numeric, (v_platform->>'date')::date) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'platform_disagrees');
    END IF;
  END IF;

  -- Bỏ qua: nguồn không phải sàn / không phải đơn vị, lệch với số được giữ.
  SELECT COALESCE(jsonb_agg(DISTINCT e->>'fp'), '[]'::jsonb) INTO v_dismiss
    FROM jsonb_array_elements(v_sources) e
   WHERE e->>'kind' NOT IN ('platform', 'owner_report')
     AND e->>'fp' IS DISTINCT FROM p_source_fp
     AND public.owner_outcome_disagrees(
           e->>'outcome', (e->>'price')::numeric, (e->>'date')::date,
           v_pick->>'outcome', (v_pick->>'price')::numeric,
           COALESCE((v_pick->>'date')::date, (v_own->>'date')::date));

  v_res := jsonb_build_object(
    'choice',    p_choice,
    'adopted',   CASE WHEN p_choice = 'use_source'
                      THEN jsonb_build_object('fp', p_source_fp, 'kind', v_pick->>'kind') END,
    'dismissed', v_dismiss
  );

  BEGIN
    IF p_choice = 'keep_mine' THEN
      UPDATE public.owner_asset_outcomes o
         SET conflict_resolution = v_res
       WHERE o.id = (v_own->>'ref_id')::uuid AND o.workspace_id = p_workspace_id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_id := (v_own->>'ref_id')::uuid;
    ELSIF v_own IS NOT NULL THEN
      UPDATE public.owner_asset_outcomes o
         SET outcome             = v_pick->>'outcome',
             winning_price       = CASE WHEN v_pick->>'outcome' = 'sold' THEN (v_pick->>'price')::numeric END,
             failure_reason      = CASE WHEN v_pick->>'outcome' = 'sold' THEN NULL ELSE o.failure_reason END,
             conflict_resolution = v_res
       WHERE o.id = (v_own->>'ref_id')::uuid AND o.workspace_id = p_workspace_id;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      v_id := (v_own->>'ref_id')::uuid;
    ELSE
      SELECT COALESCE(max(o.round_no), 0) + 1 INTO v_round
        FROM public.owner_asset_outcomes o
       WHERE o.workspace_id = p_workspace_id AND o.listing_id = p_listing_id;
      INSERT INTO public.owner_asset_outcomes (
        workspace_id, listing_id, round_no, auction_date, outcome, winning_price,
        source, reported_by, conflict_resolution
      ) VALUES (
        p_workspace_id, p_listing_id, v_round,
        COALESCE((v_pick->>'date')::date, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date),
        v_pick->>'outcome',
        CASE WHEN v_pick->>'outcome' = 'sold' THEN (v_pick->>'price')::numeric END,
        'owner_manual', auth.uid(), v_res
      )
      RETURNING id INTO v_id;
      v_n := 1;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END;

  IF v_n = 0 THEN
    -- RLS lọc mất dòng: ngoài phạm vi chi nhánh.
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorized');
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_finalize_report(p_report_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r         public.owner_report_snapshots%ROWTYPE;
  v_payload JSONB;
  v_now     TIMESTAMPTZ := now();
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO r FROM public.owner_report_snapshots WHERE id = p_report_id FOR UPDATE;
  -- Không phải thành viên ⇒ giả như không tồn tại (không lộ id của không gian khác).
  IF NOT FOUND OR NOT public.owner_ws_can(r.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_ws_has_in(r.workspace_id, 'bao-cao-dinh-ky', 'finalize', r.branch_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF r.status = 'final' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_final');
  END IF;

  v_payload := public.owner_build_report_payload(r.workspace_id, r.period_type, r.period_start, r.branch_id)
    || jsonb_build_object(
         'notes', jsonb_build_object(
           'officer', NULLIF(btrim(r.notes), ''),
           'plan',    NULLIF(btrim(r.plan_note), '')),
         'people', jsonb_build_object(
           'prepared_by',  (SELECT NULLIF(btrim(p.name), '') FROM public.profiles p WHERE p.id = r.created_by),
           'finalized_by', (SELECT NULLIF(btrim(p.name), '') FROM public.profiles p WHERE p.id = auth.uid())),
         'finalized_at', v_now);

  UPDATE public.owner_report_snapshots
     SET status       = 'final',
         payload      = v_payload,
         finalized_at = v_now,
         finalized_by = auth.uid()
   WHERE id = r.id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_share_report(p_report_id uuid, p_days integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r        public.owner_report_snapshots%ROWTYPE;
  v_now    TIMESTAMPTZ := now();
  v_expiry TIMESTAMPTZ;
  v_active BOOLEAN;
  v_token  TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO r FROM public.owner_report_snapshots WHERE id = p_report_id FOR UPDATE;
  -- Không phải thành viên ⇒ giả như không tồn tại.
  IF NOT FOUND OR NOT public.owner_ws_can(r.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_ws_has_in(r.workspace_id, 'bao-cao-dinh-ky', 'share', r.branch_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF r.status <> 'final' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_final');
  END IF;
  IF p_days IS NULL OR p_days < 1 OR p_days > 90 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_days');
  END IF;

  v_expiry := v_now + make_interval(days => p_days);
  v_active := r.share_token IS NOT NULL AND r.token_expires_at > v_now;

  IF v_active THEN
    v_token := r.share_token;
    UPDATE public.owner_report_snapshots
       SET token_expires_at = v_expiry
     WHERE id = r.id;
  ELSE
    v_token := public.owner_report_new_share_token();
    UPDATE public.owner_report_snapshots
       SET share_token      = v_token,
           token_expires_at = v_expiry,
           shared_at        = v_now,
           shared_by        = auth.uid()
     WHERE id = r.id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'token', v_token, 'expires_at', v_expiry, 'renewed', v_active);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_revoke_report_share(p_report_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.owner_report_snapshots%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO r FROM public.owner_report_snapshots WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND OR NOT public.owner_ws_can(r.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_ws_has_in(r.workspace_id, 'bao-cao-dinh-ky', 'share', r.branch_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF r.share_token IS NOT NULL THEN
    UPDATE public.owner_report_snapshots
       SET share_token = NULL, token_expires_at = NULL, shared_at = NULL, shared_by = NULL
     WHERE id = r.id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_report_share_link(p_report_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.owner_report_snapshots%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO r FROM public.owner_report_snapshots WHERE id = p_report_id;
  IF NOT FOUND OR NOT public.owner_ws_can(r.workspace_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_ws_has_in(r.workspace_id, 'bao-cao-dinh-ky', 'share', r.branch_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'ok',         true,
    'token',      CASE WHEN r.token_expires_at > now() THEN r.share_token END,
    'expires_at', r.token_expires_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_update_kyc_address(_kind text, _address text, _ward text DEFAULT NULL::text, _province text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      UUID := auth.uid();
  v_address  TEXT := NULLIF(btrim(COALESCE(_address, '')), '');
  v_ward     TEXT := NULLIF(btrim(COALESCE(_ward, '')), '');
  v_province TEXT := NULLIF(btrim(COALESCE(_province, '')), '');
  v_id       UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF _kind IS NULL OR _kind NOT IN ('individual', 'organization') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_kind');
  END IF;
  IF v_address IS NULL OR char_length(v_address) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'address_required');
  END IF;

  IF _kind = 'individual' THEN
    UPDATE public.asset_owner_kyc
       SET address = v_address, ward = v_ward, province = v_province
     WHERE user_id = v_uid
    RETURNING id INTO v_id;
  ELSE
    -- KYC tổ chức đã sinh không gian thuộc về KHÔNG GIAN: người tạo đã rời đơn vị
    -- không được sửa địa chỉ Bên A của mọi hợp đồng sau này. Đường sửa cho
    -- Trưởng đơn vị là owner_ws_update_org_address.
    UPDATE public.asset_owner_org_kyc k
       SET head_office_address = v_address, head_office_province = v_province
     WHERE k.created_by = v_uid
       AND NOT EXISTS (SELECT 1 FROM public.asset_owner_workspaces w
                        WHERE w.org_kyc_id = k.id
                          AND NOT public.owner_ws_has(w.id, 'chi-nhanh', 'update'))
    RETURNING k.id INTO v_id;
  END IF;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'kyc_not_found');
  END IF;

  INSERT INTO public.asset_owner_kyc_events (entity_type, entity_id, action, actor_id, data)
  VALUES (
    CASE WHEN _kind = 'individual' THEN 'individual_kyc' ELSE 'org_kyc' END,
    v_id, 'address_updated', v_uid,
    jsonb_build_object('address', v_address, 'ward', v_ward, 'province', v_province)
  );

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_posting_party_address(p_posting_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  v JSONB;
BEGIN
  SELECT ap.workspace_id, ap.user_id INTO p FROM public.asset_postings ap WHERE ap.id = p_posting_id;
  IF NOT FOUND OR NOT public.owner_posting_can(p_posting_id, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  v := public.consignment_posting_owner_party(p_posting_id);
  RETURN jsonb_build_object(
    'ok', true,
    'kind', v ->> 'kind',
    'address', v ->> 'address',
    'ward', v ->> 'ward',
    'province', v ->> 'province',
    'workspace_id', p.workspace_id,
    'can_edit', CASE
                  WHEN p.workspace_id IS NULL
                    THEN p.user_id = auth.uid() AND v ->> 'kind' = 'individual'
                  ELSE public.owner_ws_has(p.workspace_id, 'chi-nhanh', 'update') AND v ->> 'kind' = 'organization'
                END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.owner_ws_update_org_address(p_workspace_id uuid, _address text, _province text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      UUID := auth.uid();
  v_address  TEXT := NULLIF(btrim(COALESCE(_address, '')), '');
  v_province TEXT := NULLIF(btrim(COALESCE(_province, '')), '');
  v_id       UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.owner_ws_has(p_workspace_id, 'chi-nhanh', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF v_address IS NULL OR char_length(v_address) < 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'address_required');
  END IF;

  UPDATE public.asset_owner_org_kyc k
     SET head_office_address = v_address, head_office_province = v_province
    FROM public.asset_owner_workspaces w
   WHERE w.id = p_workspace_id AND k.id = w.org_kyc_id AND k.status = 'approved'
  RETURNING k.id INTO v_id;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'kyc_not_found');
  END IF;

  INSERT INTO public.asset_owner_kyc_events (entity_type, entity_id, action, actor_id, data)
  VALUES ('org_kyc', v_id, 'address_updated', v_uid,
          jsonb_build_object('address', v_address, 'province', v_province,
                             'workspace_id', p_workspace_id));

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.run_workspace_match(p_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     AND NOT public.owner_ws_has(p_workspace_id, 'chi-nhanh', 'update')
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
$function$;

CREATE OR REPLACE FUNCTION public.owner_ws_request_link(p_parent_ws uuid, p_child_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reason TEXT;
  v_id     UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('owner_ws_link'));
  IF NOT public.owner_ws_has(p_parent_ws, 'lien-ket', 'update') THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.owner_ws_cancel_link_request(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r public.owner_workspace_link_requests%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('owner_ws_link'));
  SELECT * INTO r FROM public.owner_workspace_link_requests WHERE id = p_request_id;
  IF NOT FOUND OR NOT public.owner_ws_has(r.parent_workspace_id, 'lien-ket', 'update') THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.owner_ws_respond_link(p_request_id uuid, p_accept boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r        public.owner_workspace_link_requests%ROWTYPE;
  v_reason TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('owner_ws_link'));
  SELECT * INTO r FROM public.owner_workspace_link_requests WHERE id = p_request_id;
  IF NOT FOUND OR NOT public.owner_ws_has(r.child_workspace_id, 'lien-ket', 'update') THEN
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
$function$;

CREATE OR REPLACE FUNCTION public.owner_ws_unlink(p_child_ws uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c public.asset_owner_workspaces%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('owner_ws_link'));
  SELECT * INTO c FROM public.asset_owner_workspaces WHERE id = p_child_ws;
  IF NOT FOUND
     OR NOT (public.owner_ws_has(c.id, 'lien-ket', 'update')
             OR (c.parent_workspace_id IS NOT NULL
                 AND public.owner_ws_has(c.parent_workspace_id, 'lien-ket', 'update'))) THEN
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
$function$;

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
                               WHERE m.user_id = auth.uid() AND m.status = 'active' AND public.owner_ws_role_is_owner(m.role_id))
       AND (_name = ANY (COALESCE(p.ownership_proof_urls, '{}') || COALESCE(p.doc_urls, '{}'))
            OR EXISTS (SELECT 1 FROM public.asset_legal_consultations c
                        WHERE c.asset_posting_id = p.id
                          AND _name = ANY (COALESCE(c.submitted_doc_paths, '{}'))))
       AND public.owner_posting_file_owner_ok(p.workspace_id, p.user_id,
                                              public.consignment_path_uuid(_name, 1))
  )
$function$;

-- ─── Policy ghi theo module (ALTER giữ nguyên TO authenticated) ──────────────

-- Thiết lập đơn vị & chi nhánh
ALTER POLICY asset_owner_workspaces_manage_update ON public.asset_owner_workspaces
  USING (public.owner_ws_has(id, 'chi-nhanh', 'update'))
  WITH CHECK (public.owner_ws_has(id, 'chi-nhanh', 'update'));
ALTER POLICY workspace_branches_manage_insert ON public.workspace_branches
  WITH CHECK (public.owner_ws_has(workspace_id, 'chi-nhanh', 'update'));
ALTER POLICY workspace_branches_manage_update ON public.workspace_branches
  USING (public.owner_ws_has(workspace_id, 'chi-nhanh', 'update'))
  WITH CHECK (public.owner_ws_has(workspace_id, 'chi-nhanh', 'update'));
ALTER POLICY workspace_branches_manage_delete ON public.workspace_branches
  USING (public.owner_ws_has(workspace_id, 'chi-nhanh', 'update'));

-- Lời mời mang token ⇒ chỉ người mời được mới đọc.
ALTER POLICY asset_owner_workspace_invites_manager_read ON public.asset_owner_workspace_invites
  USING (public.owner_ws_has(workspace_id, 'thanh-vien', 'create'));

-- Số hoá tài sản (xoá hồ sơ không có UI ⇒ tính là sửa)
ALTER POLICY asset_postings_owner_insert ON public.asset_postings
  WITH CHECK ((user_id = auth.uid())
              AND public.owner_posting_row_can(workspace_id, branch_id, user_id, 'so-hoa', 'create')
              AND (review_status = 'pending') AND (reviewed_at IS NULL) AND (reviewed_by IS NULL)
              AND (rejection_reason IS NULL) AND (review_notes IS NULL));
ALTER POLICY asset_postings_owner_update ON public.asset_postings
  USING (public.owner_posting_row_can(workspace_id, branch_id, user_id, 'so-hoa', 'update'))
  WITH CHECK (public.owner_posting_row_can(workspace_id, branch_id, user_id, 'so-hoa', 'update'));
ALTER POLICY asset_postings_owner_delete ON public.asset_postings
  USING (public.owner_posting_row_can(workspace_id, branch_id, user_id, 'so-hoa', 'update'));

-- Ký gửi: gửi yêu cầu báo giá tới tổ chức / nhờ sàn chọn giúp
ALTER POLICY asr_owner_insert ON public.asset_service_requests
  WITH CHECK ((auth.uid() = user_id) AND (status = 'sent') AND (origin = 'owner')
              AND public.owner_posting_can(asset_posting_id, 'ky-gui', 'create'));
ALTER POLICY abr_owner_insert ON public.asset_broker_requests
  WITH CHECK ((auth.uid() = user_id) AND (status = 'pending')
              AND public.owner_posting_can(asset_posting_id, 'ky-gui', 'create'));

-- Kết quả phiên (khai = sửa: đính biên bản / xử lý lệch đều là UPDATE)
ALTER POLICY owner_asset_outcomes_insert ON public.owner_asset_outcomes
  WITH CHECK (public.owner_ws_has_in(workspace_id, 'ket-qua', 'update', branch_id));
ALTER POLICY owner_asset_outcomes_update ON public.owner_asset_outcomes
  USING (public.owner_ws_has_in(workspace_id, 'ket-qua', 'update', branch_id))
  WITH CHECK (public.owner_ws_has_in(workspace_id, 'ket-qua', 'update', branch_id));
ALTER POLICY owner_asset_outcomes_delete ON public.owner_asset_outcomes
  USING (public.owner_ws_has_in(workspace_id, 'ket-qua', 'delete', branch_id));

ALTER POLICY owner_outcome_evidence_insert ON storage.objects
  WITH CHECK ((bucket_id = 'owner-outcome-evidence') AND public.owner_outcome_evidence_ok(name, 'upload'));
ALTER POLICY owner_outcome_evidence_delete ON storage.objects
  USING ((bucket_id = 'owner-outcome-evidence') AND public.owner_outcome_evidence_ok(name, 'remove'));

-- Thu tiền
ALTER POLICY owner_cash_events_insert ON public.owner_cash_events
  WITH CHECK (public.owner_cash_event_ok(outcome_id, 'create'));
ALTER POLICY owner_cash_events_update ON public.owner_cash_events
  USING (public.owner_cash_event_ok(outcome_id, 'update'))
  WITH CHECK (public.owner_cash_event_ok(outcome_id, 'update'));
ALTER POLICY owner_cash_events_delete ON public.owner_cash_events
  USING (public.owner_cash_event_ok(outcome_id, 'delete'));

-- Báo cáo định kỳ (nháp; chốt / chia sẻ đi qua RPC)
ALTER POLICY owner_report_snapshots_insert ON public.owner_report_snapshots
  WITH CHECK ((status = 'draft') AND public.owner_ws_has_in(workspace_id, 'bao-cao-dinh-ky', 'create', branch_id));
ALTER POLICY owner_report_snapshots_update ON public.owner_report_snapshots
  USING ((status = 'draft') AND public.owner_ws_has_in(workspace_id, 'bao-cao-dinh-ky', 'update', branch_id))
  WITH CHECK ((status = 'draft') AND public.owner_ws_has_in(workspace_id, 'bao-cao-dinh-ky', 'update', branch_id));
ALTER POLICY owner_report_snapshots_delete ON public.owner_report_snapshots
  USING ((status = 'draft') AND public.owner_ws_has_in(workspace_id, 'bao-cao-dinh-ky', 'delete', branch_id));

-- Chỉ tiêu (trước đây gắn nhầm vào manage_members)
ALTER POLICY owner_workspace_targets_insert ON public.owner_workspace_targets
  WITH CHECK (public.owner_ws_has_in(workspace_id, 'chi-tieu', 'create', branch_id));
ALTER POLICY owner_workspace_targets_update ON public.owner_workspace_targets
  USING (public.owner_ws_has_in(workspace_id, 'chi-tieu', 'update', branch_id))
  WITH CHECK (public.owner_ws_has_in(workspace_id, 'chi-tieu', 'update', branch_id));
ALTER POLICY owner_workspace_targets_delete ON public.owner_workspace_targets
  USING (public.owner_ws_has_in(workspace_id, 'chi-tieu', 'delete', branch_id));

-- Tiêu chí đi theo chỉ tiêu cha: tạo mới cần create hoặc update; sửa / xoá cần update.
-- (Xoá chỉ tiêu cascade tiêu chí, không qua RLS.)
ALTER POLICY owner_workspace_target_criteria_insert ON public.owner_workspace_target_criteria
  WITH CHECK (EXISTS (SELECT 1 FROM public.owner_workspace_targets t
                       WHERE t.id = target_id AND t.workspace_id = owner_workspace_target_criteria.workspace_id
                         AND (public.owner_ws_has_in(t.workspace_id, 'chi-tieu', 'create', t.branch_id)
                              OR public.owner_ws_has_in(t.workspace_id, 'chi-tieu', 'update', t.branch_id))));
ALTER POLICY owner_workspace_target_criteria_update ON public.owner_workspace_target_criteria
  USING (EXISTS (SELECT 1 FROM public.owner_workspace_targets t
                  WHERE t.id = target_id AND t.workspace_id = owner_workspace_target_criteria.workspace_id
                    AND public.owner_ws_has_in(t.workspace_id, 'chi-tieu', 'update', t.branch_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.owner_workspace_targets t
                       WHERE t.id = target_id AND t.workspace_id = owner_workspace_target_criteria.workspace_id
                         AND public.owner_ws_has_in(t.workspace_id, 'chi-tieu', 'update', t.branch_id)));
ALTER POLICY owner_workspace_target_criteria_delete ON public.owner_workspace_target_criteria
  USING (EXISTS (SELECT 1 FROM public.owner_workspace_targets t
                  WHERE t.id = target_id AND t.workspace_id = owner_workspace_target_criteria.workspace_id
                    AND public.owner_ws_has_in(t.workspace_id, 'chi-tieu', 'update', t.branch_id)));

-- ─── Thành viên & lời mời ───────────────────────────────────────────────────

DROP FUNCTION public.owner_ws_list_members(UUID);
CREATE FUNCTION public.owner_ws_list_members(p_workspace_id UUID)
RETURNS TABLE (
  member_id    UUID,
  user_id      UUID,
  full_name    TEXT,
  email        TEXT,
  role         TEXT,       -- tier di sản cho frontend cũ — bỏ ở bước C
  role_id      UUID,
  role_name    TEXT,
  is_owner     BOOLEAN,
  branch_scope UUID[],
  status       TEXT,
  joined_at    TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.id, m.user_id, p.name, p.email,
         public.owner_ws_role_tier(m.role_id),
         r.id, r.name, COALESCE(r.is_system, false),
         m.branch_scope, m.status, m.joined_at
    FROM public.asset_owner_workspace_members m
    JOIN public.profiles p ON p.id = m.user_id
    LEFT JOIN public.owner_ws_roles r ON r.id = m.role_id
   WHERE m.workspace_id = p_workspace_id
     AND m.status = 'active'
     AND public.owner_ws_role(p_workspace_id) IS NOT NULL
   ORDER BY COALESCE(r.is_system, false) DESC,
            r.name,
            m.joined_at NULLS LAST,
            p.email
$$;

CREATE FUNCTION public.owner_ws_create_invite(p_workspace_id UUID, p_email TEXT, p_role_id UUID, p_branch_scope UUID[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid   UUID := auth.uid();
  _email TEXT := lower(btrim(COALESCE(p_email, '')));
  _scope UUID[];
  _role  public.owner_ws_roles%ROWTYPE;
  _inv   public.asset_owner_workspace_invites%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  PERFORM 1 FROM public.asset_owner_workspaces WHERE id = p_workspace_id FOR UPDATE;
  IF NOT FOUND OR NOT public.owner_ws_has(p_workspace_id, 'thanh-vien', 'create') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF _email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_email');
  END IF;

  -- Trưởng đơn vị không mời thẳng được: tham gia xong mới đổi vai trò.
  SELECT * INTO _role FROM public.owner_ws_roles WHERE id = p_role_id AND workspace_id = p_workspace_id;
  IF NOT FOUND OR _role.is_system THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_role');
  END IF;
  IF NOT public.owner_ws_role_within_user(_role.id, _uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exceeds_own_permissions');
  END IF;

  IF COALESCE(cardinality(p_branch_scope), 0) > 0 THEN
    _scope := ARRAY(SELECT DISTINCT s FROM unnest(p_branch_scope) AS s);
    IF NOT public.owner_ws_scope_valid(p_workspace_id, _scope) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_scope');
    END IF;
  END IF;
  IF NOT public.owner_ws_scope_within_user(p_workspace_id, _uid, _scope) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exceeds_own_scope');
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.asset_owner_workspace_members m
      JOIN public.profiles p ON p.id = m.user_id
     WHERE m.workspace_id = p_workspace_id
       AND m.status = 'active'
       AND lower(btrim(p.email)) = _email
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_member');
  END IF;

  -- Lời mời hết hạn không được chặn việc mời lại.
  UPDATE public.asset_owner_workspace_invites
     SET revoked_at = now()
   WHERE workspace_id = p_workspace_id
     AND email = _email
     AND accepted_at IS NULL
     AND revoked_at IS NULL
     AND expires_at <= now();

  BEGIN
    INSERT INTO public.asset_owner_workspace_invites
      (workspace_id, email, role_id, branch_scope, invited_by)
    VALUES (p_workspace_id, _email, _role.id, _scope, _uid)
    RETURNING * INTO _inv;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_invited');
  END;

  RETURN jsonb_build_object(
    'ok', true, 'id', _inv.id, 'token', _inv.token, 'expires_at', _inv.expires_at
  );
END;
$$;

-- Overload cũ (frontend cũ + scripts/seed-owner-demo.py) — bỏ ở bước C.
CREATE OR REPLACE FUNCTION public.owner_ws_create_invite(p_workspace_id UUID, p_email TEXT, p_role TEXT, p_branch_scope UUID[] DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p_role IN ('staff', 'viewer') THEN
      public.owner_ws_create_invite(
        p_workspace_id, p_email,
        (SELECT r.id FROM public.owner_ws_roles r
          WHERE r.workspace_id = p_workspace_id AND r.code = upper(p_role)),
        p_branch_scope)
    ELSE jsonb_build_object('ok', false, 'reason', 'invalid_role')
  END
$$;

-- Lời mời chỉ còn hiệu lực khi người mời VẪN có quyền mời, và vai trò vẫn nằm trong
-- quyền của họ.
CREATE OR REPLACE FUNCTION public.owner_ws_invite_preview(p_token TEXT)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT jsonb_build_object(
              'ok',             true,
              'workspace_name', w.primary_name,
              'role',           public.owner_ws_role_tier(i.role_id),  -- di sản, bỏ ở bước C
              'role_name',      r.name,
              'invite_email',   i.email,
              'expired',        i.expires_at <= now(),
              'accepted',       i.accepted_at IS NOT NULL,
              'accepted_by_me', i.accepted_at IS NOT NULL
                                AND auth.uid() IS NOT NULL
                                AND i.accepted_by = auth.uid(),
              'revoked',        i.revoked_at IS NOT NULL
                                OR (i.accepted_at IS NULL AND (
                                      i.role_id IS NULL
                                   OR NOT public.owner_ws_user_has(i.workspace_id, i.invited_by, 'thanh-vien', 'create')
                                   OR NOT public.owner_ws_role_within_user(i.role_id, i.invited_by)))
            )
       FROM public.asset_owner_workspace_invites i
       JOIN public.asset_owner_workspaces w ON w.id = i.workspace_id
       LEFT JOIN public.owner_ws_roles r ON r.id = i.role_id
      WHERE i.token = p_token),
    jsonb_build_object('ok', false, 'reason', 'not_found')
  )
$$;

CREATE OR REPLACE FUNCTION public.owner_ws_accept_invite(p_token TEXT)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid       UUID := auth.uid();
  _inv       public.asset_owner_workspace_invites%ROWTYPE;
  _existing  public.asset_owner_workspace_members%ROWTYPE;
  _email     TEXT;
  _activated BOOLEAN;
  _status    TEXT;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _inv FROM public.asset_owner_workspace_invites WHERE token = p_token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  -- Cùng thứ tự khoá với các RPC khác: workspace trước, rồi tới lời mời.
  PERFORM 1 FROM public.asset_owner_workspaces WHERE id = _inv.workspace_id FOR UPDATE;
  SELECT * INTO _inv FROM public.asset_owner_workspace_invites WHERE id = _inv.id FOR UPDATE;

  IF _inv.accepted_at IS NOT NULL THEN
    IF _inv.accepted_by = _uid THEN
      RETURN jsonb_build_object('ok', true, 'workspace_id', _inv.workspace_id, 'already_member', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'reason', 'already_accepted');
  END IF;

  IF _inv.revoked_at IS NOT NULL
     OR _inv.role_id IS NULL
     OR NOT public.owner_ws_user_has(_inv.workspace_id, _inv.invited_by, 'thanh-vien', 'create')
     OR NOT public.owner_ws_role_within_user(_inv.role_id, _inv.invited_by) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;

  IF _inv.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  SELECT p.email, p.activated, p.status
    INTO _email, _activated, _status
    FROM public.profiles p WHERE p.id = _uid;

  IF COALESCE(_status, 'active') = 'locked' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'locked');
  END IF;

  IF lower(btrim(COALESCE(_email, ''))) <> _inv.email THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_mismatch', 'invite_email', _inv.email);
  END IF;

  IF NOT COALESCE(_activated, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_activated');
  END IF;

  -- Chi nhánh trong phạm vi đã bị xoá sau khi mời ⇒ KHÔNG nới thành toàn không gian.
  IF _inv.branch_scope IS NOT NULL
     AND NOT public.owner_ws_scope_valid(_inv.workspace_id, _inv.branch_scope) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_scope');
  END IF;

  SELECT * INTO _existing
    FROM public.asset_owner_workspace_members
   WHERE workspace_id = _inv.workspace_id AND user_id = _uid
   FOR UPDATE;

  IF FOUND AND _existing.status = 'active' THEN
    UPDATE public.asset_owner_workspace_invites
       SET accepted_at = now(), accepted_by = _uid
     WHERE id = _inv.id;
    RETURN jsonb_build_object('ok', true, 'workspace_id', _inv.workspace_id, 'already_member', true);
  END IF;

  -- Dòng cũ đã gỡ / chưa kích hoạt: xoá rồi thêm mới. UPDATE một dòng từng là
  -- Trưởng đơn vị sẽ bị guard coi là "thu hồi vai trò" và chặn người được mời.
  IF FOUND THEN
    DELETE FROM public.asset_owner_workspace_members WHERE id = _existing.id;
  END IF;

  INSERT INTO public.asset_owner_workspace_members
    (workspace_id, user_id, role_id, branch_scope, status, invited_by, joined_at)
  VALUES
    (_inv.workspace_id, _uid, _inv.role_id, _inv.branch_scope, 'active', _inv.invited_by, now());

  UPDATE public.asset_owner_workspace_invites
     SET accepted_at = now(), accepted_by = _uid
   WHERE id = _inv.id;

  RETURN jsonb_build_object('ok', true, 'workspace_id', _inv.workspace_id);
END;
$$;

CREATE FUNCTION public.owner_ws_update_member(p_member_id UUID, p_role_id UUID, p_branch_scope UUID[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid          UUID := auth.uid();
  _m            public.asset_owner_workspace_members%ROWTYPE;
  _role         public.owner_ws_roles%ROWTYPE;
  _target_owner BOOLEAN;
  _caller_owner BOOLEAN;
  _scope        UUID[];
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _m FROM public.asset_owner_workspace_members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  PERFORM 1 FROM public.asset_owner_workspaces WHERE id = _m.workspace_id FOR UPDATE;
  IF NOT public.owner_ws_has(_m.workspace_id, 'thanh-vien', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  -- Đọc lại sau khi khoá: một giao dịch khác có thể vừa đổi dòng này.
  SELECT * INTO _m FROM public.asset_owner_workspace_members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND OR _m.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF _m.user_id = _uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cannot_change_self');
  END IF;

  SELECT * INTO _role FROM public.owner_ws_roles WHERE id = p_role_id AND workspace_id = _m.workspace_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_role');
  END IF;

  _target_owner := public.owner_ws_role_is_owner(_m.role_id);
  _caller_owner := public.owner_ws_is_owner(_m.workspace_id);

  IF (_role.is_system OR _target_owner) AND NOT _caller_owner THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'owner_only');
  END IF;
  IF NOT _caller_owner AND (NOT public.owner_ws_role_within_user(_m.role_id, _uid)
                            OR NOT public.owner_ws_role_within_user(_role.id, _uid)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exceeds_own_permissions');
  END IF;

  -- Trưởng đơn vị luôn toàn Trạm ⇒ bỏ qua phạm vi gửi lên.
  IF NOT _role.is_system AND COALESCE(cardinality(p_branch_scope), 0) > 0 THEN
    _scope := ARRAY(SELECT DISTINCT s FROM unnest(p_branch_scope) AS s);
    IF NOT public.owner_ws_scope_valid(_m.workspace_id, _scope) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_scope');
    END IF;
  END IF;
  IF NOT _caller_owner AND (NOT public.owner_ws_scope_within_user(_m.workspace_id, _uid, _m.branch_scope)
                            OR NOT public.owner_ws_scope_within_user(_m.workspace_id, _uid, _scope)) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exceeds_own_scope');
  END IF;

  -- Người gọi là Trưởng đơn vị khác ⇒ luôn còn; giữ kiểm tra này làm lưới an toàn.
  IF _target_owner AND NOT _role.is_system AND NOT EXISTS (
    SELECT 1
      FROM public.asset_owner_workspace_members o
      JOIN public.owner_ws_roles r ON r.id = o.role_id
     WHERE o.workspace_id = _m.workspace_id AND r.is_system
       AND o.status = 'active' AND o.id <> _m.id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'last_owner');
  END IF;

  UPDATE public.asset_owner_workspace_members
     SET role_id = _role.id, branch_scope = _scope
   WHERE id = _m.id;

  -- Hết quyền mời ⇒ các lời mời người này gửi mà chưa dùng cũng hết hiệu lực.
  IF NOT public.owner_ws_user_has(_m.workspace_id, _m.user_id, 'thanh-vien', 'create') THEN
    UPDATE public.asset_owner_workspace_invites
       SET revoked_at = now()
     WHERE workspace_id = _m.workspace_id AND invited_by = _m.user_id
       AND accepted_at IS NULL AND revoked_at IS NULL;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Overload cũ — bỏ ở bước C.
CREATE OR REPLACE FUNCTION public.owner_ws_update_member(p_member_id UUID, p_role TEXT, p_branch_scope UUID[] DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p_role IN ('owner', 'staff', 'viewer') THEN
      public.owner_ws_update_member(
        p_member_id,
        (SELECT r.id
           FROM public.asset_owner_workspace_members m
           JOIN public.owner_ws_roles r ON r.workspace_id = m.workspace_id AND r.code = upper(p_role)
          WHERE m.id = p_member_id),
        p_branch_scope)
    ELSE jsonb_build_object('ok', false, 'reason', 'invalid_role')
  END
$$;

CREATE OR REPLACE FUNCTION public.owner_ws_remove_member(p_member_id UUID)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid          UUID := auth.uid();
  _m            public.asset_owner_workspace_members%ROWTYPE;
  _target_owner BOOLEAN;
  _caller_owner BOOLEAN;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _m FROM public.asset_owner_workspace_members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  PERFORM 1 FROM public.asset_owner_workspaces WHERE id = _m.workspace_id FOR UPDATE;
  IF NOT public.owner_ws_has(_m.workspace_id, 'thanh-vien', 'delete') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO _m FROM public.asset_owner_workspace_members WHERE id = p_member_id FOR UPDATE;
  IF NOT FOUND OR _m.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF _m.user_id = _uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cannot_remove_self');
  END IF;

  _target_owner := public.owner_ws_role_is_owner(_m.role_id);
  _caller_owner := public.owner_ws_is_owner(_m.workspace_id);

  IF _target_owner AND NOT _caller_owner THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'owner_only');
  END IF;
  IF NOT _caller_owner AND NOT public.owner_ws_role_within_user(_m.role_id, _uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exceeds_own_permissions');
  END IF;
  IF NOT _caller_owner AND NOT public.owner_ws_scope_within_user(_m.workspace_id, _uid, _m.branch_scope) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'exceeds_own_scope');
  END IF;

  IF _target_owner AND NOT EXISTS (
    SELECT 1
      FROM public.asset_owner_workspace_members o
      JOIN public.owner_ws_roles r ON r.id = o.role_id
     WHERE o.workspace_id = _m.workspace_id AND r.is_system
       AND o.status = 'active' AND o.id <> _m.id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'last_owner');
  END IF;

  UPDATE public.asset_owner_workspace_members SET status = 'removed' WHERE id = _m.id;

  UPDATE public.asset_owner_workspace_invites
     SET revoked_at = now()
   WHERE workspace_id = _m.workspace_id AND invited_by = _m.user_id
     AND accepted_at IS NULL AND revoked_at IS NULL;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_ws_revoke_invite(p_invite_id UUID)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _inv public.asset_owner_workspace_invites%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _inv FROM public.asset_owner_workspace_invites WHERE id = p_invite_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF NOT public.owner_ws_has(_inv.workspace_id, 'thanh-vien', 'create') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO _inv FROM public.asset_owner_workspace_invites WHERE id = p_invite_id FOR UPDATE;
  IF _inv.accepted_at IS NOT NULL OR _inv.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_pending');
  END IF;

  UPDATE public.asset_owner_workspace_invites SET revoked_at = now() WHERE id = _inv.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── Vai trò: đọc + ghi qua RPC ─────────────────────────────────────────────

CREATE FUNCTION public.owner_ws_list_roles(p_workspace_id UUID)
RETURNS TABLE (
  id           UUID,
  name         TEXT,
  code         TEXT,
  description  TEXT,
  is_system    BOOLEAN,
  permissions  JSONB,
  member_count INT,
  invite_count INT,
  created_at   TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.name, r.code, r.description, r.is_system,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('module', p.module, 'action', p.action)
                                    ORDER BY p.module, p.action)
                     FROM public.owner_ws_role_permissions p WHERE p.role_id = r.id), '[]'::jsonb),
         (SELECT count(*)::int FROM public.asset_owner_workspace_members m
           WHERE m.role_id = r.id AND m.status = 'active'),
         (SELECT count(*)::int FROM public.asset_owner_workspace_invites i
           WHERE i.role_id = r.id AND i.accepted_at IS NULL AND i.revoked_at IS NULL
             AND i.expires_at > now()),
         r.created_at, r.updated_at
    FROM public.owner_ws_roles r
   WHERE r.workspace_id = p_workspace_id
     AND public.owner_ws_role(p_workspace_id) IS NOT NULL
   ORDER BY r.is_system DESC, (r.code IN ('STAFF', 'VIEWER')) DESC, r.created_at, r.name
$$;

-- Vai trò của người gọi trong Trạm (NULL nếu không là thành viên).
CREATE FUNCTION public.owner_ws_my_role_id(p_workspace_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.role_id FROM public.asset_owner_workspace_members m
   WHERE m.workspace_id = p_workspace_id AND m.user_id = auth.uid() AND m.status = 'active'
$$;

CREATE FUNCTION public.owner_ws_create_role(p_workspace_id UUID, p_name TEXT, p_description TEXT DEFAULT NULL,
                                            p_copy_from_role_id UUID DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid  UUID := auth.uid();
  _name TEXT := btrim(COALESCE(p_name, ''));
  _desc TEXT := NULLIF(btrim(COALESCE(p_description, '')), '');
  _src  public.owner_ws_roles%ROWTYPE;
  _id   UUID;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  PERFORM 1 FROM public.asset_owner_workspaces WHERE id = p_workspace_id FOR UPDATE;
  IF NOT FOUND OR NOT public.owner_ws_has(p_workspace_id, 'vai-tro', 'create') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF char_length(_name) NOT BETWEEN 2 AND 60 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_name');
  END IF;
  IF char_length(COALESCE(_desc, '')) > 300 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_description');
  END IF;

  IF p_copy_from_role_id IS NOT NULL THEN
    SELECT * INTO _src FROM public.owner_ws_roles
     WHERE id = p_copy_from_role_id AND workspace_id = p_workspace_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'invalid_role');
    END IF;
    IF NOT public.owner_ws_role_within_user(_src.id, _uid) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'exceeds_own_permissions');
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.owner_ws_roles (workspace_id, name, code, description, created_by)
    VALUES (p_workspace_id, _name,
            'CUSTOM_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
            _desc, _uid)
    RETURNING id INTO _id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_taken');
  END;

  IF _src.id IS NOT NULL THEN
    INSERT INTO public.owner_ws_role_permissions (role_id, module, action)
    SELECT _id, c.module, c.action
      FROM public.owner_ws_permission_catalog() c
     WHERE _src.is_system  -- sao chép Trưởng đơn vị = toàn bộ danh mục
        OR EXISTS (SELECT 1 FROM public.owner_ws_role_permissions p
                    WHERE p.role_id = _src.id AND p.module = c.module AND p.action = c.action);
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', _id);
END;
$$;

CREATE FUNCTION public.owner_ws_update_role(p_role_id UUID, p_name TEXT, p_description TEXT DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid  UUID := auth.uid();
  _name TEXT := btrim(COALESCE(p_name, ''));
  _desc TEXT := NULLIF(btrim(COALESCE(p_description, '')), '');
  _role public.owner_ws_roles%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _role FROM public.owner_ws_roles WHERE id = p_role_id;
  IF NOT FOUND OR public.owner_ws_role(_role.workspace_id) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  PERFORM 1 FROM public.asset_owner_workspaces WHERE id = _role.workspace_id FOR UPDATE;
  IF NOT public.owner_ws_has(_role.workspace_id, 'vai-tro', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO _role FROM public.owner_ws_roles WHERE id = p_role_id FOR UPDATE;
  IF _role.is_system THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'system_role');
  END IF;
  IF NOT public.owner_ws_is_owner(_role.workspace_id) THEN
    IF public.owner_ws_my_role_id(_role.workspace_id) = _role.id THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cannot_edit_own_role');
    END IF;
    IF NOT public.owner_ws_role_within_user(_role.id, _uid) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'exceeds_own_permissions');
    END IF;
  END IF;

  IF char_length(_name) NOT BETWEEN 2 AND 60 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_name');
  END IF;
  IF char_length(COALESCE(_desc, '')) > 300 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_description');
  END IF;

  BEGIN
    UPDATE public.owner_ws_roles SET name = _name, description = _desc WHERE id = _role.id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_taken');
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE FUNCTION public.owner_ws_delete_role(p_role_id UUID)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid     UUID := auth.uid();
  _role    public.owner_ws_roles%ROWTYPE;
  _members INT;
  _invites INT;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _role FROM public.owner_ws_roles WHERE id = p_role_id;
  IF NOT FOUND OR public.owner_ws_role(_role.workspace_id) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  PERFORM 1 FROM public.asset_owner_workspaces WHERE id = _role.workspace_id FOR UPDATE;
  IF NOT public.owner_ws_has(_role.workspace_id, 'vai-tro', 'delete') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO _role FROM public.owner_ws_roles WHERE id = p_role_id FOR UPDATE;
  IF _role.is_system THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'system_role');
  END IF;
  IF NOT public.owner_ws_is_owner(_role.workspace_id) THEN
    IF public.owner_ws_my_role_id(_role.workspace_id) = _role.id THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cannot_edit_own_role');
    END IF;
    IF NOT public.owner_ws_role_within_user(_role.id, _uid) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'exceeds_own_permissions');
    END IF;
  END IF;

  SELECT count(*) INTO _members FROM public.asset_owner_workspace_members
   WHERE role_id = _role.id AND status <> 'removed';
  SELECT count(*) INTO _invites FROM public.asset_owner_workspace_invites
   WHERE role_id = _role.id AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now();
  IF _members > 0 OR _invites > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'role_in_use',
                              'member_count', _members, 'invite_count', _invites);
  END IF;

  -- Lời mời đã hết hạn mà chưa dùng: thu hồi để FK SET NULL không vi phạm CHECK.
  UPDATE public.asset_owner_workspace_invites
     SET revoked_at = now()
   WHERE role_id = _role.id AND accepted_at IS NULL AND revoked_at IS NULL;

  DELETE FROM public.owner_ws_roles WHERE id = _role.id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Thay NGUYÊN bộ quyền. p_permissions = [{module, action}, …]; 'view' của module được
-- tự thêm khi có thao tác khác. Người không phải Trưởng đơn vị: không sửa vai trò của
-- chính mình, không cấp quyền mình không có.
CREATE FUNCTION public.owner_ws_set_role_permissions(p_role_id UUID, p_permissions JSONB)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid   UUID := auth.uid();
  _role  public.owner_ws_roles%ROWTYPE;
  _perms JSONB;
  _count INT;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO _role FROM public.owner_ws_roles WHERE id = p_role_id;
  IF NOT FOUND OR public.owner_ws_role(_role.workspace_id) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  PERFORM 1 FROM public.asset_owner_workspaces WHERE id = _role.workspace_id FOR UPDATE;
  IF NOT public.owner_ws_has(_role.workspace_id, 'vai-tro', 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  SELECT * INTO _role FROM public.owner_ws_roles WHERE id = p_role_id FOR UPDATE;
  IF _role.is_system THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'system_role');
  END IF;

  IF p_permissions IS NULL OR jsonb_typeof(p_permissions) <> 'array'
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_permissions) e WHERE jsonb_typeof(e) <> 'object') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_permission');
  END IF;

  -- Chuẩn hoá: bỏ trùng + tự thêm 'view' của mọi module có mặt.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('module', q.module, 'action', q.action)), '[]'::jsonb)
    INTO _perms
    FROM (SELECT e ->> 'module' AS module, e ->> 'action' AS action FROM jsonb_array_elements(p_permissions) e
          UNION
          SELECT e ->> 'module', 'view' FROM jsonb_array_elements(p_permissions) e) q;

  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(_perms) AS q(module TEXT, action TEXT)
     WHERE NOT EXISTS (SELECT 1 FROM public.owner_ws_permission_catalog() c
                        WHERE c.module = q.module AND c.action = q.action)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_permission');
  END IF;

  IF NOT public.owner_ws_is_owner(_role.workspace_id) THEN
    IF public.owner_ws_my_role_id(_role.workspace_id) = _role.id THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'cannot_edit_own_role');
    END IF;
    IF NOT public.owner_ws_role_within_user(_role.id, _uid)
       OR EXISTS (SELECT 1 FROM jsonb_to_recordset(_perms) AS q(module TEXT, action TEXT)
                   WHERE NOT public.owner_ws_has(_role.workspace_id, q.module, q.action)) THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'exceeds_own_permissions');
    END IF;
  END IF;

  DELETE FROM public.owner_ws_role_permissions WHERE role_id = _role.id;
  INSERT INTO public.owner_ws_role_permissions (role_id, module, action)
  SELECT _role.id, q.module, q.action FROM jsonb_to_recordset(_perms) AS q(module TEXT, action TEXT);
  GET DIAGNOSTICS _count = ROW_COUNT;

  UPDATE public.owner_ws_roles SET updated_at = now() WHERE id = _role.id;

  -- Tới bước C: "chạm" các dòng để trigger đồng bộ tính lại tier di sản.
  UPDATE public.asset_owner_workspace_members SET role_id = role_id WHERE role_id = _role.id;
  UPDATE public.asset_owner_workspace_invites SET role_id = role_id
   WHERE role_id = _role.id AND accepted_at IS NULL AND revoked_at IS NULL;

  -- Vai trò mất quyền mời ⇒ lời mời chưa dùng do người giữ vai trò này gửi hết hiệu lực.
  IF NOT _perms @> '[{"module": "thanh-vien", "action": "create"}]'::jsonb THEN
    UPDATE public.asset_owner_workspace_invites i
       SET revoked_at = now()
     WHERE i.workspace_id = _role.workspace_id
       AND i.accepted_at IS NULL AND i.revoked_at IS NULL
       AND i.invited_by IN (SELECT m.user_id FROM public.asset_owner_workspace_members m
                             WHERE m.role_id = _role.id AND m.status = 'active');
  END IF;

  RETURN jsonb_build_object('ok', true, 'count', _count);
END;
$$;

-- ─── Thu tiền: tách khỏi quyền sửa kết quả ─────────────────────────────────
-- "Đã thu đủ" giờ là DEFINER và tự kiểm thu-tien:create — trước đây FOR UPDATE của
-- INVOKER đòi quyền UPDATE kết quả, nên vai trò kiểu "Kế toán" sẽ phải có cả ket-qua.

CREATE OR REPLACE FUNCTION public.owner_cash_settle(p_outcome_id UUID, p_occurred_on DATE DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws      UUID;
  v_outcome TEXT;
  v_price   NUMERIC;
  v_status  TEXT;
  v_paid    NUMERIC;
  v_left    NUMERIC;
  v_id      UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT o.workspace_id, o.outcome, o.winning_price, o.payment_status, o.paid_amount
    INTO v_ws, v_outcome, v_price, v_status, v_paid
    FROM public.owner_asset_outcomes o
   WHERE o.id = p_outcome_id
     FOR UPDATE;
  IF NOT FOUND OR NOT public.owner_ws_can(v_ws, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_cash_event_ok(p_outcome_id, 'create') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  IF v_outcome <> 'sold' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_sold');
  END IF;
  IF v_status = 'defaulted' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'defaulted');
  END IF;

  v_left := COALESCE(v_price, 0) - COALESCE(v_paid, 0);
  IF v_left <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_paid');
  END IF;

  INSERT INTO public.owner_cash_events (outcome_id, kind, amount, occurred_on)
  VALUES (p_outcome_id, 'payment', v_left,
          COALESCE(p_occurred_on, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'amount', v_left);
END;
$$;

-- Hạn người trúng nộp đủ tiền (NULL = mặc định ngày phiên + 30).
CREATE FUNCTION public.owner_cash_set_due(p_outcome_id UUID, p_due_on DATE)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT o.workspace_id INTO v_ws FROM public.owner_asset_outcomes o WHERE o.id = p_outcome_id FOR UPDATE;
  IF NOT FOUND OR NOT public.owner_ws_can(v_ws, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_cash_event_ok(p_outcome_id, 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  UPDATE public.owner_asset_outcomes SET payment_due_on = p_due_on WHERE id = p_outcome_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Cờ "Người trúng bỏ cọc" (bỏ cờ ⇒ trigger tính lại trạng thái từ sổ thu chi).
CREATE FUNCTION public.owner_cash_set_defaulted(p_outcome_id UUID, p_defaulted BOOLEAN)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ws UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT o.workspace_id INTO v_ws FROM public.owner_asset_outcomes o WHERE o.id = p_outcome_id FOR UPDATE;
  IF NOT FOUND OR NOT public.owner_ws_can(v_ws, 'read') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT public.owner_cash_event_ok(p_outcome_id, 'update') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  UPDATE public.owner_asset_outcomes
     SET payment_status = CASE WHEN p_defaulted THEN 'defaulted' ELSE 'pending' END
   WHERE id = p_outcome_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ─── Quyền thực thi ─────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.owner_ws_legacy_action(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_ws_has_in(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_role_within_user(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_ws_scope_within_user(UUID, UUID, UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_ws_invites_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_ws_roles_protect() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_posting_row_can(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_posting_can(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_list_members(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_create_invite(UUID, TEXT, UUID, UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_update_member(UUID, UUID, UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_list_roles(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_my_role_id(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_create_role(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_update_role(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_delete_role(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_set_role_permissions(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_cash_set_due(UUID, DATE) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_cash_set_defaulted(UUID, BOOLEAN) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.owner_ws_has_in(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_posting_row_can(UUID, UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_posting_can(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_list_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_create_invite(UUID, TEXT, UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_update_member(UUID, UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_list_roles(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_my_role_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_create_role(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_update_role(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_delete_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_set_role_permissions(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_cash_set_due(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_cash_set_defaulted(UUID, BOOLEAN) TO authenticated;

-- ─── Self-check ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  _bad TEXT;
BEGIN
  -- 1. Không còn action ghi kiểu cũ trong hàm / policy nào.
  SELECT string_agg(x, ', ') INTO _bad FROM (
    SELECT p.oid::regprocedure::text AS x
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname NOT IN ('owner_ws_legacy_action')
       AND (p.prosrc ~ 'owner_ws_can\s*\([^)]*''(write|manage_members|manage_workspace|send_report)'''
         OR p.prosrc ~ 'owner_posting_can\s*\([^,()]*,\s*''write'''
         OR p.prosrc ~ 'owner_posting_row_can\s*\([^,()]*,[^,()]*,[^,()]*,\s*''write'''
         OR p.prosrc ~ '(owner_cash_event_ok|owner_outcome_evidence_ok)\s*\([^,()]*,\s*''write''')
    UNION ALL
    SELECT pol.schemaname || '.' || pol.tablename || ':' || pol.policyname
      FROM pg_policies pol
     WHERE coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '')
           ~ '(owner_ws_can\s*\([^)]*''(write|manage_members|manage_workspace|send_report)''|owner_posting_can\s*\([^,()]*,\s*''write''|owner_posting_row_can\s*\([^,()]*,[^,()]*,[^,()]*,\s*''write''|(owner_cash_event_ok|owner_outcome_evidence_ok)\s*\([^,()]*,\s*''write'')'
  ) s;
  IF _bad IS NOT NULL THEN
    RAISE EXCEPTION 'self-check: còn kiểm quyền kiểu cũ ở: %', _bad;
  END IF;

  -- 2. Không hàm nào còn đọc cột role di sản của thành viên / lời mời (trừ trigger đồng bộ).
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO _bad
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.prosrc ~ 'asset_owner_workspace_(members|invites)'
     AND p.prosrc ~ '(\m(m|o|i|_m|_inv|_existing|NEW|OLD)\.role\M|m\.role\s*=)'
     AND p.proname NOT IN ('owner_ws_sync_role_columns');
  IF _bad IS NOT NULL THEN
    RAISE EXCEPTION 'self-check: còn hàm đọc cột role di sản: %', _bad;
  END IF;

  -- 3. Ngày chuyển không ai thêm / mất quyền: ma trận mới = vai trò cũ (tier).
  SELECT string_agg(DISTINCT m.user_id::text || '@' || m.workspace_id::text, ', ') INTO _bad
    FROM public.asset_owner_workspace_members m
   CROSS JOIN public.owner_ws_permission_catalog() c
   WHERE m.status = 'active'
     AND public.owner_ws_user_has(m.workspace_id, m.user_id, c.module, c.action)
         IS DISTINCT FROM CASE m.role
           WHEN 'owner'  THEN true
           WHEN 'staff'  THEN EXISTS (SELECT 1 FROM public.owner_ws_default_role_permissions('STAFF') d
                                       WHERE d.module = c.module AND d.action = c.action)
           ELSE c.action = 'view'
         END;
  IF _bad IS NOT NULL THEN
    RAISE EXCEPTION 'self-check: quyền lệch so với vai trò cũ: %', _bad;
  END IF;

  -- 4. Mỗi Trạm còn ít nhất một Trưởng đơn vị đang hoạt động.
  IF EXISTS (
    SELECT 1 FROM public.asset_owner_workspaces w
     WHERE NOT EXISTS (
       SELECT 1 FROM public.asset_owner_workspace_members m
         JOIN public.owner_ws_roles r ON r.id = m.role_id
        WHERE m.workspace_id = w.id AND m.status = 'active' AND r.is_system)
  ) THEN
    RAISE EXCEPTION 'self-check: có Trạm không còn Trưởng đơn vị';
  END IF;

  -- 5. anon không gọi được hàm nào của hệ vai trò (trừ xem trước lời mời).
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO _bad
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND (p.proname LIKE 'owner_ws\_%' OR p.proname IN ('owner_posting_can', 'owner_posting_row_can',
                                                         'owner_cash_set_due', 'owner_cash_set_defaulted',
                                                         'owner_cash_settle', 'owner_cash_event_ok'))
     AND p.proname <> 'owner_ws_invite_preview'
     AND p.prorettype <> 'trigger'::regtype  -- hàm trigger không gọi trực tiếp được
     AND has_function_privilege('anon', p.oid, 'EXECUTE');
  IF _bad IS NOT NULL THEN
    RAISE EXCEPTION 'self-check: anon còn EXECUTE: %', _bad;
  END IF;
END;
$$;
