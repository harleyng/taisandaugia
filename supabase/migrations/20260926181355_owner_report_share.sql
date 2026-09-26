-- Link chia sẻ báo cáo định kỳ — Phase 11 của docs/owner-control-tower-plan.md (§A5).
--
-- Trưởng đơn vị ('send_report') tạo một link CHỈ ĐỌC /r/:token cho báo cáo ĐÃ CHỐT để
-- gửi trụ sở — người nhận không cần đăng nhập. Link có hạn (1–90 ngày), gia hạn được,
-- thu hồi được bất cứ lúc nào.
--
-- Quyết định (người dùng chốt 2026-09-26): CHỈ Trưởng đơn vị thấy / sao chép được
-- token. Cán bộ / người xem chỉ thấy trạng thái (hết hạn, lượt xem) ⇒ cột share_token
-- bị rút quyền SELECT của authenticated (quyền SELECT theo CỘT), token đọc qua RPC
-- owner_report_share_link.
--
-- Chỉ báo cáo đã chốt mới chia sẻ được (bản nháp không có payload đóng băng).
-- "Tạo link" khi link còn hạn = GIA HẠN (giữ token — link đã gửi vẫn mở được);
-- link đã hết hạn ⇒ cấp token mới. Thu hồi xoá token nhưng giữ lịch sử lượt xem.
-- Lượt xem chỉ đếm người NGOÀI đơn vị (thành viên tự mở thử không tính) — P14 dùng
-- con số này làm tín hiệu bán hàng.
--
-- Payload công khai đi qua owner_report_public_payload: chỉ giữ các phần của báo cáo
-- và gỡ mọi khoá id / người trúng / biên bản (payload v1 vốn đã không có, đây là lớp
-- phòng thủ cho các phiên bản payload sau).

LOCK TABLE public.owner_report_snapshots IN ACCESS EXCLUSIVE MODE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Cột + ràng buộc
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.owner_report_snapshots
  -- 32 byte ngẫu nhiên, base64url (43 ký tự). NULL = chưa chia sẻ / đã thu hồi.
  ADD COLUMN share_token      TEXT,
  ADD COLUMN token_expires_at TIMESTAMPTZ,
  -- Lượt mở link của người ngoài đơn vị, cộng dồn qua các lần tạo link.
  ADD COLUMN view_count       INT NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  ADD COLUMN last_viewed_at   TIMESTAMPTZ,
  -- Link hiện tại do ai tạo, lúc nào (gia hạn không đổi hai cột này).
  ADD COLUMN shared_at        TIMESTAMPTZ,
  ADD COLUMN shared_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.owner_report_snapshots
  ADD CONSTRAINT ors_share_final_only CHECK (
    status = 'final'
    OR (share_token IS NULL AND token_expires_at IS NULL AND shared_at IS NULL
        AND shared_by IS NULL AND view_count = 0 AND last_viewed_at IS NULL)
  ),
  ADD CONSTRAINT ors_share_pair CHECK (
    (share_token IS NULL) = (token_expires_at IS NULL)
    AND (share_token IS NULL) = (shared_at IS NULL)
  ),
  ADD CONSTRAINT ors_share_token_format CHECK (
    share_token IS NULL OR share_token ~ '^[A-Za-z0-9_-]{43}$'
  );

CREATE UNIQUE INDEX ors_share_token_uq ON public.owner_report_snapshots (share_token)
  WHERE share_token IS NOT NULL;
CREATE INDEX idx_ors_shared_by ON public.owner_report_snapshots (shared_by);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Trigger bảo vệ — nới cho cột chia sẻ + hành động SET NULL của FK người dùng
--
--    Phase 10 chỉ cho branch_id về NULL ⇒ xoá tài khoản từng lập / chốt báo cáo bị
--    chặn ("Báo cáo đã chốt không thể sửa"); ở bản nháp, dòng NEW.created_by :=
--    OLD.created_by còn đảo ngược SET NULL (để lại FK treo). Tên người lập / chốt
--    đã đóng băng trong payload.people nên cho các cột *_by về NULL.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.owner_report_snapshots_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  -- Đổi được trên báo cáo đã chốt: link chia sẻ (chỉ RPC SECURITY DEFINER ghi — client
  -- không có quyền cột) + updated_at (trigger kế tiếp tự đặt).
  c_mutable CONSTANT TEXT[] := ARRAY['share_token', 'token_expires_at', 'view_count',
                                     'last_viewed_at', 'shared_at', 'shared_by', 'updated_at'];
  -- Chỉ được về NULL (hành động ON DELETE SET NULL).
  c_fk      CONSTANT TEXT[] := ARRAY['branch_id', 'created_by', 'finalized_by'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      -- Người lập là người đang đăng nhập; báo cáo luôn sinh ra ở dạng nháp.
      NEW.created_by := auth.uid();
      IF NEW.status <> 'draft' OR NEW.payload IS NOT NULL
         OR NEW.finalized_at IS NOT NULL OR NEW.finalized_by IS NOT NULL THEN
        RAISE EXCEPTION 'Báo cáo mới phải ở dạng nháp';
      END IF;
    END IF;
  ELSE
    IF OLD.status = 'final' THEN
      -- Đã chốt ⇒ đóng băng, trừ các cột ở trên.
      IF (to_jsonb(NEW) - c_mutable - c_fk) IS DISTINCT FROM (to_jsonb(OLD) - c_mutable - c_fk)
         OR (NEW.branch_id    IS NOT NULL AND NEW.branch_id    IS DISTINCT FROM OLD.branch_id)
         OR (NEW.created_by   IS NOT NULL AND NEW.created_by   IS DISTINCT FROM OLD.created_by)
         OR (NEW.finalized_by IS NOT NULL AND NEW.finalized_by IS DISTINCT FROM OLD.finalized_by) THEN
        RAISE EXCEPTION 'Báo cáo đã chốt không thể sửa';
      END IF;
      RETURN NEW;
    END IF;
    IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
      RAISE EXCEPTION 'Không thể chuyển báo cáo sang không gian khác';
    END IF;
    -- Người lập không đổi — trừ khi tài khoản bị xoá (SET NULL).
    IF NEW.created_by IS NOT NULL THEN
      NEW.created_by := OLD.created_by;
    END IF;
  END IF;

  IF NEW.branch_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.branch_id IS DISTINCT FROM OLD.branch_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.workspace_branches wb
        WHERE wb.id = NEW.branch_id AND wb.workspace_id = NEW.workspace_id
     ) THEN
    RAISE EXCEPTION 'Chi nhánh không thuộc đơn vị này';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_report_snapshots_guard() FROM PUBLIC, anon, authenticated;

-- Lượt xem không phải là "sửa báo cáo" ⇒ không đổi updated_at.
DROP TRIGGER owner_report_snapshots_updated_at ON public.owner_report_snapshots;
CREATE TRIGGER owner_report_snapshots_updated_at
  BEFORE UPDATE ON public.owner_report_snapshots
  FOR EACH ROW
  WHEN (OLD.view_count IS NOT DISTINCT FROM NEW.view_count)
  EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Quyền cột: authenticated đọc mọi cột TRỪ share_token. Hệ quả: KHÔNG được
--    select('*') trên bảng này (PostgREST báo permission denied) — luôn liệt kê cột.
--    Cột chia sẻ không có quyền INSERT / UPDATE (Phase 10 đã rút quyền cấp bảng).
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE SELECT ON public.owner_report_snapshots FROM authenticated;
GRANT SELECT (id, workspace_id, branch_id, period_type, period_start, status, notes, plan_note,
              payload, finalized_at, finalized_by, created_by, created_at, updated_at,
              token_expires_at, view_count, last_viewed_at, shared_at, shared_by)
  ON public.owner_report_snapshots TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Hàm nội bộ
-- ═══════════════════════════════════════════════════════════════════════════

-- pgcrypto nằm ở schema extensions ⇒ gọi tên đầy đủ.
CREATE OR REPLACE FUNCTION public.owner_report_new_share_token()
RETURNS TEXT
LANGUAGE sql VOLATILE SET search_path = public
AS $$
  SELECT rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=')
$$;

REVOKE ALL ON FUNCTION public.owner_report_new_share_token() FROM PUBLIC, anon, authenticated;

-- Gỡ đệ quy mọi khoá riêng tư: id / *_id / *_ids, người trúng (winner*), biên bản (*evidence*).
CREATE OR REPLACE FUNCTION public.owner_report_strip_private(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
BEGIN
  CASE jsonb_typeof(p)
    WHEN 'object' THEN
      RETURN (
        SELECT COALESCE(jsonb_object_agg(e.key, public.owner_report_strip_private(e.value)), '{}'::jsonb)
          FROM jsonb_each(p) e
         WHERE NOT (e.key = 'id' OR e.key ~ '_ids?$' OR e.key ~* '^winner' OR e.key ~* 'evidence')
      );
    WHEN 'array' THEN
      RETURN (
        SELECT COALESCE(jsonb_agg(public.owner_report_strip_private(a.value) ORDER BY a.ord), '[]'::jsonb)
          FROM jsonb_array_elements(p) WITH ORDINALITY a(value, ord)
      );
    ELSE
      RETURN p;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_report_strip_private(JSONB) FROM PUBLIC, anon, authenticated;

-- Payload công khai = chỉ các phần của báo cáo (danh sách trắng cấp 1) + gỡ khoá riêng tư.
CREATE OR REPLACE FUNCTION public.owner_report_public_payload(p JSONB)
RETURNS JSONB
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT public.owner_report_strip_private(COALESCE(
    (SELECT jsonb_object_agg(e.key, e.value)
       FROM jsonb_each(p) e
      WHERE e.key IN ('version', 'meta', 'targets', 'results', 'money', 'stuck', 'plan',
                      'notes', 'people', 'finalized_at')),
    '{}'::jsonb))
$$;

REVOKE ALL ON FUNCTION public.owner_report_public_payload(JSONB) FROM PUBLIC, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RPC của Trưởng đơn vị ('send_report'). Trả {ok:false, reason} cho thất bại
--    dự kiến ⇒ client dùng assertOwnerReportRpcOk.
-- ═══════════════════════════════════════════════════════════════════════════

-- Tạo link (hoặc gia hạn link còn hạn) — hạn mới = bây giờ + p_days.
CREATE OR REPLACE FUNCTION public.owner_share_report(p_report_id UUID, p_days INT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
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
  IF NOT public.owner_ws_can(r.workspace_id, 'send_report') THEN
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
$$;

REVOKE ALL ON FUNCTION public.owner_share_report(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_share_report(UUID, INT) TO authenticated;

-- Thu hồi: link cũ mở ra "không còn hiệu lực". Giữ lịch sử lượt xem. Gọi lại vô hại.
CREATE OR REPLACE FUNCTION public.owner_revoke_report_share(p_report_id UUID)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
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
  IF NOT public.owner_ws_can(r.workspace_id, 'send_report') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  IF r.share_token IS NOT NULL THEN
    UPDATE public.owner_report_snapshots
       SET share_token = NULL, token_expires_at = NULL, shared_at = NULL, shared_by = NULL
     WHERE id = r.id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_revoke_report_share(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_revoke_report_share(UUID) TO authenticated;

-- Đọc token để sao chép lại — chỉ khi link còn hạn.
CREATE OR REPLACE FUNCTION public.owner_report_share_link(p_report_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
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
  IF NOT public.owner_ws_can(r.workspace_id, 'send_report') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

  RETURN jsonb_build_object(
    'ok',         true,
    'token',      CASE WHEN r.token_expires_at > now() THEN r.share_token END,
    'expires_at', r.token_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_report_share_link(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_report_share_link(UUID) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RPC công khai — trang /r/:token (anon). Không bao giờ trả id báo cáo,
--    workspace_id, trạng thái hay số lượt xem.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_shared_owner_report(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
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

  -- Chỉ đếm người ngoài đơn vị (thành viên mở thử link không tính).
  IF auth.uid() IS NULL OR NOT public.owner_ws_can(r.workspace_id, 'read') THEN
    UPDATE public.owner_report_snapshots
       SET view_count = view_count + 1, last_viewed_at = now()
     WHERE id = r.id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'report', jsonb_build_object(
      'payload',    public.owner_report_public_payload(r.payload),
      'expires_at', r.token_expires_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_owner_report(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_owner_report(TEXT) TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Tự kiểm
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  c TEXT;
  v JSONB;
BEGIN
  IF has_column_privilege('authenticated', 'public.owner_report_snapshots', 'share_token', 'SELECT') THEN
    RAISE EXCEPTION 'owner_report_share self-check: authenticated còn đọc được share_token';
  END IF;
  FOREACH c IN ARRAY ARRAY['id', 'payload', 'status', 'token_expires_at', 'view_count', 'last_viewed_at'] LOOP
    IF NOT has_column_privilege('authenticated', 'public.owner_report_snapshots', c, 'SELECT') THEN
      RAISE EXCEPTION 'owner_report_share self-check: authenticated mất quyền đọc cột %', c;
    END IF;
  END LOOP;
  FOREACH c IN ARRAY ARRAY['share_token', 'token_expires_at', 'view_count', 'last_viewed_at', 'shared_at', 'shared_by'] LOOP
    IF has_column_privilege('authenticated', 'public.owner_report_snapshots', c, 'UPDATE')
       OR has_column_privilege('authenticated', 'public.owner_report_snapshots', c, 'INSERT') THEN
      RAISE EXCEPTION 'owner_report_share self-check: client ghi được cột %', c;
    END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.owner_report_snapshots', 'SELECT') THEN
    RAISE EXCEPTION 'owner_report_share self-check: anon đọc được bảng';
  END IF;

  IF NOT has_function_privilege('anon', 'public.get_shared_owner_report(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner_report_share self-check: anon không gọi được get_shared_owner_report';
  END IF;
  IF has_function_privilege('anon', 'public.owner_share_report(uuid, integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_revoke_report_share(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_report_share_link(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.owner_report_public_payload(jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.owner_report_public_payload(jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.owner_report_strip_private(jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.owner_report_new_share_token()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.owner_report_snapshots_guard()', 'EXECUTE') THEN
    RAISE EXCEPTION 'owner_report_share self-check: hàm nội bộ / RPC đang mở quá rộng';
  END IF;

  IF public.owner_report_new_share_token() !~ '^[A-Za-z0-9_-]{43}$' THEN
    RAISE EXCEPTION 'owner_report_share self-check: token sai định dạng';
  END IF;

  v := public.owner_report_public_payload(jsonb_build_object(
    'version', 1,
    'workspace_id', 'x',
    'secret_extra', 'x',
    'meta', jsonb_build_object('unit_name', 'Đơn vị A', 'workspace_id', 'x', 'branch_id', 'x'),
    'results', jsonb_build_object('items', jsonb_build_array(jsonb_build_object(
      'title', 'Tài sản', 'asset_code', 'ABCDEF12', 'listing_id', 'x', 'id', 'x',
      'evidence_urls', jsonb_build_array('x'), 'winner_name', 'x', 'Winner', 'x', 'bidder_ids', jsonb_build_array('x'))))
  ));
  IF v::text ~* '(workspace_id|branch_id|listing_id|evidence|winner|bidder_ids|secret_extra|"id")' THEN
    RAISE EXCEPTION 'owner_report_share self-check: payload công khai còn khoá riêng tư: %', v;
  END IF;
  IF v #>> '{meta,unit_name}' IS DISTINCT FROM 'Đơn vị A'
     OR v #>> '{results,items,0,asset_code}' IS DISTINCT FROM 'ABCDEF12'
     OR (v ->> 'version') IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'owner_report_share self-check: bộ lọc gỡ nhầm dữ liệu báo cáo: %', v;
  END IF;
END;
$$;
