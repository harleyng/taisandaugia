-- Phase 4 — docs/owner-control-tower-plan.md: hồ sơ số hoá thuộc KHÔNG GIAN, không thuộc cá nhân.
--
-- Trước đây asset_postings và mọi thứ treo trên nó (yêu cầu tổ chức, nhờ sàn chọn
-- giúp, hợp đồng ký gửi, bên bán của hợp đồng mua bán, 3D, VR, giám định, tư vấn
-- pháp lý / đấu giá) khoá theo user_id ⇒ cán bộ nghỉ việc là đơn vị mất hồ sơ.
--
-- Mô hình mới ("tenant"):
--   workspace_id NULL  = hồ sơ CÁ NHÂN — chỉ người tạo (như cũ).
--   workspace_id có    = hồ sơ của KHÔNG GIAN — quyền theo vai trò thành viên đang
--                        hoạt động (owner_ws_can); người tạo đã rời đơn vị MẤT quyền.
--   branch_id          = chi nhánh; Cán bộ bị giới hạn phạm vi chỉ GHI trong phạm vi.
-- user_id từ nay chỉ còn nghĩa "người tạo" — KHÔNG policy/RPC nào dùng nó làm cổng
-- quyền cho hồ sơ của không gian.
--
-- Mọi thân hàm sửa ở đây chép từ pg_get_functiondef của DB thật (không từ migration
-- cũ), chỉ đổi dòng kiểm quyền. Mọi policy viết lại đều TO authenticated.

-- Khoá trước MỌI bảng sẽ đổi cột / policy / trigger, trong một câu, theo một thứ
-- tự — lần áp đầu tiên chết vì deadlock với truy vấn đang đọc org_kyc ⋈ postings.
LOCK TABLE public.asset_postings, public.asset_owner_org_kyc, public.workspace_branches,
           public.asset_service_requests, public.asset_broker_requests,
           public.consignment_contracts, public.consignment_contract_events,
           public.asset_3d_scans, public.asset_vr_tour_orders,
           public.asset_authentication_orders, public.asset_authentication_requirements,
           public.asset_legal_consultations, public.asset_legal_consultation_items,
           public.asset_auction_consultations, public.asset_auction_consult_proposals,
           public.auction_sale_contracts, public.owner_asset_outcomes
  IN ACCESS EXCLUSIVE MODE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Cột + ràng buộc
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.workspace_branches
  ADD CONSTRAINT workspace_branches_workspace_id_id_key UNIQUE (workspace_id, id);

-- RESTRICT: SET NULL sẽ trả hồ sơ của ngân hàng về làm hồ sơ cá nhân của người tạo
-- (lộ dữ liệu), CASCADE sẽ xoá sạch. Không gian còn hồ sơ thì không xoá được.
ALTER TABLE public.asset_postings
  ADD COLUMN workspace_id UUID REFERENCES public.asset_owner_workspaces(id) ON DELETE RESTRICT,
  ADD COLUMN branch_id    UUID;

-- FK kép: chi nhánh phải thuộc ĐÚNG không gian của hồ sơ (và chặn luôn việc
-- chuyển một chi nhánh đang được tham chiếu sang không gian khác). Xoá chi nhánh
-- ⇒ chỉ branch_id về NULL.
ALTER TABLE public.asset_postings
  ADD CONSTRAINT asset_postings_branch_fkey FOREIGN KEY (workspace_id, branch_id)
    REFERENCES public.workspace_branches (workspace_id, id) ON DELETE SET NULL (branch_id),
  ADD CONSTRAINT asset_postings_branch_needs_workspace
    CHECK (branch_id IS NULL OR workspace_id IS NOT NULL);

CREATE INDEX idx_asset_postings_workspace_id ON public.asset_postings (workspace_id);
CREATE INDEX idx_asset_postings_branch_id    ON public.asset_postings (branch_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Backfill — TẮT review guard (nuốt thay đổi + hạ hồ sơ đã duyệt về pending)
--    và updated_at (đừng làm giả "ngày cập nhật").
--
--    • Người KHÔNG có KYC cá nhân, là Trưởng đơn vị của đúng 1 không gian ⇒ không gian đó.
--    • Người CÓ KYC cá nhân ⇒ chỉ chuyển hồ sơ có bằng chứng là của tổ chức (hợp đồng
--      ký gửi chưa huỷ với Bên A là tổ chức); còn lại giữ Cá nhân — đừng đẩy CCCD của
--      một cá nhân sang cho cả ngân hàng đọc.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.asset_postings DISABLE TRIGGER asset_postings_review_guard;
ALTER TABLE public.asset_postings DISABLE TRIGGER asset_postings_updated_at;

WITH sole_owner AS (
  SELECT m.user_id, (array_agg(m.workspace_id))[1] AS workspace_id
    FROM public.asset_owner_workspace_members m
   WHERE m.role = 'owner' AND m.status = 'active'
   GROUP BY m.user_id
  HAVING count(*) = 1
)
UPDATE public.asset_postings p
   SET workspace_id = so.workspace_id
  FROM sole_owner so
 WHERE so.user_id = p.user_id
   AND p.workspace_id IS NULL
   AND (
     NOT EXISTS (SELECT 1 FROM public.asset_owner_kyc k
                  WHERE k.user_id = p.user_id AND k.status = 'approved')
     OR EXISTS (SELECT 1 FROM public.consignment_contracts c
                 WHERE c.asset_posting_id = p.id AND c.status <> 'cancelled'
                   AND c.owner_party ->> 'kind' = 'organization')
   );

ALTER TABLE public.asset_postings ENABLE TRIGGER asset_postings_review_guard;
ALTER TABLE public.asset_postings ENABLE TRIGGER asset_postings_updated_at;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Hàm quyền dùng chung
-- ═══════════════════════════════════════════════════════════════════════════

-- Quyền trên một dòng hồ sơ (dùng thẳng trong policy của asset_postings để khỏi
-- tra lại bảng). Cá nhân = người tạo làm mọi thứ; không gian: read = thành viên
-- đang hoạt động, write = Trưởng đơn vị/Cán bộ + phạm vi chi nhánh.
CREATE OR REPLACE FUNCTION public.owner_posting_row_can(
  p_workspace_id UUID, p_branch_id UUID, p_user_id UUID, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    CASE
      WHEN p_workspace_id IS NULL THEN p_user_id = auth.uid()
      WHEN p_action = 'read'      THEN public.owner_ws_can(p_workspace_id, 'read')
      WHEN p_action = 'write'     THEN public.owner_ws_can(p_workspace_id, 'write')
                                       AND public.owner_ws_branch_ok(p_workspace_id, p_branch_id)
    END,
    false)
$$;

-- Cùng quyền, theo id hồ sơ — cổng của mọi bảng con, storage và RPC phía chủ tài sản.
CREATE OR REPLACE FUNCTION public.owner_posting_can(p_posting_id UUID, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT public.owner_posting_row_can(p.workspace_id, p.branch_id, p.user_id, p_action)
      FROM public.asset_postings p
     WHERE p.id = p_posting_id), false)
$$;

-- Tệp ở thư mục gốc p_file_owner có được coi là tệp của hồ sơ không? Cá nhân: của
-- người tạo. Không gian: của một thành viên — KỂ CẢ đã rời (giấy tờ họ tải lên vẫn
-- là giấy tờ của hồ sơ). Chặn việc dán đường dẫn tệp của người ngoài vào hồ sơ để
-- đọc trộm qua policy.
CREATE OR REPLACE FUNCTION public.owner_posting_file_owner_ok(
  p_workspace_id UUID, p_creator UUID, p_file_owner UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    p_file_owner = p_creator
    OR (p_workspace_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.asset_owner_workspace_members m
           WHERE m.workspace_id = p_workspace_id AND m.user_id = p_file_owner)),
    false)
$$;

-- Đồng nghiệp đọc giấy tờ (asset-docs) của hồ sơ thuộc không gian mình: tệp phải
-- được hồ sơ tham chiếu (giấy tờ sở hữu / hồ sơ khác / tài liệu gửi tư vấn pháp lý).
CREATE OR REPLACE FUNCTION public.owner_asset_doc_readable(_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.asset_postings p
     WHERE p.workspace_id IN (SELECT m.workspace_id FROM public.asset_owner_workspace_members m
                               WHERE m.user_id = auth.uid() AND m.status = 'active')
       AND (_name = ANY (COALESCE(p.ownership_proof_urls, '{}') || COALESCE(p.doc_urls, '{}'))
            OR EXISTS (SELECT 1 FROM public.asset_legal_consultations c
                        WHERE c.asset_posting_id = p.id
                          AND _name = ANY (COALESCE(c.submitted_doc_paths, '{}'))))
       AND public.owner_posting_file_owner_ok(p.workspace_id, p.user_id,
                                              public.consignment_path_uuid(_name, 1))
  )
$$;

-- Ai được thao tác trên hợp đồng ký gửi: phía chủ tài sản theo HỒ SƠ (không còn
-- theo owner_user_id — cột đó chỉ là "người đã chốt"), phía tổ chức giữ nguyên.
CREATE OR REPLACE FUNCTION public.consignment_contract_can_act(_contract_id UUID, _side TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN auth.uid() IS NULL THEN false
      WHEN _side = 'owner'    THEN public.owner_posting_can(c.asset_posting_id, 'write')
      ELSE public.consignment_can_act(c.owner_user_id, c.auction_org_id, c.organization_id, _side)
    END
      FROM public.consignment_contracts c
     WHERE c.id = _contract_id), false)
$$;

-- Bên bán (chủ tài sản có tài khoản) của hợp đồng mua bán: quyền theo hồ sơ của
-- hợp đồng ký gửi; hợp đồng không truy được hồ sơ thì rơi về seller_user_id.
CREATE OR REPLACE FUNCTION public.sale_owner_seller_can(
  p_consignment_contract_id UUID, p_seller_user_id UUID, p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT public.owner_posting_can(c.asset_posting_id, p_action)
       FROM public.consignment_contracts c
      WHERE c.id = p_consignment_contract_id),
    p_seller_user_id = auth.uid(),
    false)
$$;

-- Bên A của hợp đồng dịch vụ, suy từ HỒ SƠ (không từ người đang bấm):
--   • hồ sơ của không gian ⇒ KYC tổ chức đã duyệt của không gian;
--   • hồ sơ cá nhân ⇒ CHỈ KYC cá nhân của người tạo (consignment_owner_party cũ
--     ưu tiên KYC tổ chức — sai cho người vừa có KYC cá nhân vừa làm ở ngân hàng).
-- Không có KYC ⇒ 'unknown', consignment_missing_parties chặn lập dự thảo.
CREATE OR REPLACE FUNCTION public.consignment_posting_owner_party(_posting_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
  v JSONB;
BEGIN
  SELECT ap.workspace_id, ap.user_id, w.primary_name, w.org_kyc_id INTO p
    FROM public.asset_postings ap
    LEFT JOIN public.asset_owner_workspaces w ON w.id = ap.workspace_id
   WHERE ap.id = _posting_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('kind', 'unknown');
  END IF;

  IF p.workspace_id IS NOT NULL THEN
    SELECT jsonb_build_object(
             'kind', 'organization', 'org_name', k.org_name, 'tax_code', k.tax_code,
             'email', k.official_email, 'rep_full_name', k.rep_full_name, 'rep_title', k.rep_title,
             'rep_id_type', k.rep_id_type, 'rep_id_number', k.rep_id_number,
             'address', k.head_office_address, 'province', k.head_office_province)
      INTO v
      FROM public.asset_owner_org_kyc k
     WHERE k.id = p.org_kyc_id AND k.status = 'approved';
    RETURN COALESCE(v, jsonb_build_object('kind', 'unknown', 'full_name', p.primary_name));
  END IF;

  SELECT jsonb_build_object(
           'kind', 'individual', 'full_name', k.full_name, 'id_type', k.id_type,
           'id_number', k.id_number, 'phone', k.phone, 'email', k.contact_email,
           'address', k.address, 'ward', k.ward, 'province', k.province)
    INTO v
    FROM public.asset_owner_kyc k
   WHERE k.user_id = p.user_id AND k.status = 'approved'
   LIMIT 1;
  IF v IS NOT NULL THEN RETURN v; END IF;

  SELECT jsonb_build_object('kind', 'unknown', 'full_name', pr.name, 'email', pr.email)
    INTO v FROM public.profiles pr WHERE pr.id = p.user_id;
  RETURN COALESCE(v, jsonb_build_object('kind', 'unknown'));
END;
$$;

-- Lý do bắt buộc giám định của một hồ sơ, xét người bán hạn chế trên CẢ người tạo
-- lẫn người đang thao tác — không thì người bị hạn chế nhờ đồng nghiệp tạo hồ sơ
-- là thoát. Giữ nguyên thứ tự lý do của người tạo, chỉ nối thêm lý do mới.
CREATE OR REPLACE FUNCTION public._authentication_posting_reasons(_p public.asset_postings)
RETURNS TEXT[]
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base  TEXT[];
  v_extra TEXT[];
BEGIN
  v_base := public._authentication_required_reasons(_p.id, _p.user_id, _p.parent_slug, _p.starting_price);
  IF auth.uid() IS NULL OR auth.uid() = _p.user_id THEN
    RETURN v_base;
  END IF;
  v_extra := public._authentication_required_reasons(_p.id, auth.uid(), _p.parent_slug, _p.starting_price);
  RETURN v_base || ARRAY(SELECT x FROM unnest(v_extra) AS x WHERE NOT x = ANY (v_base));
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Người tạo + không gian của hồ sơ là bất biến (RAISE, không nuốt). Tên sắp
--    trước asset_postings_review_guard nhưng hàm chỉ RAISE nên thứ tự không quan
--    trọng; thứ tự còn quan trọng vẫn là review_guard < updated_at.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.asset_postings_owner_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- auth.uid() NULL = migration / service_role.
  IF auth.uid() IS NOT NULL
     AND (NEW.user_id IS DISTINCT FROM OLD.user_id
          OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id) THEN
    RAISE EXCEPTION 'POSTING_OWNER_IMMUTABLE: Không đổi được người tạo hoặc không gian của hồ sơ.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER asset_postings_owner_guard
  BEFORE UPDATE ON public.asset_postings
  FOR EACH ROW EXECUTE FUNCTION public.asset_postings_owner_guard();

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. RLS
-- ═══════════════════════════════════════════════════════════════════════════

-- asset_postings — policy admin giữ nguyên.
DROP POLICY IF EXISTS asset_postings_own_rows ON public.asset_postings;

CREATE POLICY asset_postings_owner_read ON public.asset_postings
  FOR SELECT TO authenticated
  USING (public.owner_posting_row_can(workspace_id, branch_id, user_id, 'read'));

-- Review guard chỉ chạy lúc UPDATE ⇒ chặn ở đây việc INSERT sẵn "đã duyệt".
CREATE POLICY asset_postings_owner_insert ON public.asset_postings
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.owner_posting_row_can(workspace_id, branch_id, user_id, 'write')
    AND review_status = 'pending'
    AND reviewed_at IS NULL AND reviewed_by IS NULL
    AND rejection_reason IS NULL AND review_notes IS NULL
  );

CREATE POLICY asset_postings_owner_update ON public.asset_postings
  FOR UPDATE TO authenticated
  USING      (public.owner_posting_row_can(workspace_id, branch_id, user_id, 'write'))
  WITH CHECK (public.owner_posting_row_can(workspace_id, branch_id, user_id, 'write'));

CREATE POLICY asset_postings_owner_delete ON public.asset_postings
  FOR DELETE TO authenticated
  USING (public.owner_posting_row_can(workspace_id, branch_id, user_id, 'write'));

-- Yêu cầu gửi tổ chức. user_id = người gửi. Chủ tài sản không còn UPDATE trực
-- tiếp (policy cũ cho đổi MỌI cột khi rút; giao diện không có nút rút).
DROP POLICY IF EXISTS asr_owner_read     ON public.asset_service_requests;
DROP POLICY IF EXISTS asr_owner_insert   ON public.asset_service_requests;
DROP POLICY IF EXISTS asr_owner_withdraw ON public.asset_service_requests;

CREATE POLICY asr_owner_read ON public.asset_service_requests
  FOR SELECT TO authenticated
  USING (public.owner_posting_can(asset_posting_id, 'read'));

CREATE POLICY asr_owner_insert ON public.asset_service_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND status = 'sent' AND origin = 'owner'
    AND public.owner_posting_can(asset_posting_id, 'write')
  );

-- Nhờ sàn chọn giúp: đọc + tạo theo hồ sơ; huỷ qua RPC owner_cancel_broker_request.
DROP POLICY IF EXISTS abr_owner_rows ON public.asset_broker_requests;

CREATE POLICY abr_owner_read ON public.asset_broker_requests
  FOR SELECT TO authenticated
  USING (public.owner_posting_can(asset_posting_id, 'read'));

CREATE POLICY abr_owner_insert ON public.asset_broker_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND status = 'pending'
    AND public.owner_posting_can(asset_posting_id, 'write')
  );

-- Hợp đồng ký gửi + nhật ký.
DROP POLICY IF EXISTS cc_owner_read ON public.consignment_contracts;
CREATE POLICY cc_owner_read ON public.consignment_contracts
  FOR SELECT TO authenticated
  USING (public.owner_posting_can(asset_posting_id, 'read'));

DROP POLICY IF EXISTS cce_owner_read ON public.consignment_contract_events;
CREATE POLICY cce_owner_read ON public.consignment_contract_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consignment_contracts c
                  WHERE c.id = consignment_contract_events.contract_id
                    AND public.owner_posting_can(c.asset_posting_id, 'read')));

-- Dịch vụ gắn hồ sơ: 3D / VR / giám định / tư vấn pháp lý / tư vấn đấu giá.
DROP POLICY IF EXISTS asset_3d_scans_owner_read ON public.asset_3d_scans;
CREATE POLICY asset_3d_scans_owner_read ON public.asset_3d_scans
  FOR SELECT TO authenticated
  USING (public.owner_posting_can(asset_posting_id, 'read'));

DROP POLICY IF EXISTS asset_vr_tour_orders_owner_read ON public.asset_vr_tour_orders;
CREATE POLICY asset_vr_tour_orders_owner_read ON public.asset_vr_tour_orders
  FOR SELECT TO authenticated
  USING (public.owner_posting_can(asset_posting_id, 'read'));

DROP POLICY IF EXISTS asset_authentication_orders_owner_read ON public.asset_authentication_orders;
CREATE POLICY asset_authentication_orders_owner_read ON public.asset_authentication_orders
  FOR SELECT TO authenticated
  USING (public.owner_posting_can(asset_posting_id, 'read'));

DROP POLICY IF EXISTS asset_authentication_requirements_owner_read ON public.asset_authentication_requirements;
CREATE POLICY asset_authentication_requirements_owner_read ON public.asset_authentication_requirements
  FOR SELECT TO authenticated
  USING (public.owner_posting_can(asset_posting_id, 'read'));

DROP POLICY IF EXISTS asset_legal_consultations_owner_read ON public.asset_legal_consultations;
CREATE POLICY asset_legal_consultations_owner_read ON public.asset_legal_consultations
  FOR SELECT TO authenticated
  USING (public.owner_posting_can(asset_posting_id, 'read'));

DROP POLICY IF EXISTS asset_legal_consultation_items_owner_read ON public.asset_legal_consultation_items;
CREATE POLICY asset_legal_consultation_items_owner_read ON public.asset_legal_consultation_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.asset_legal_consultations c
                  WHERE c.id = asset_legal_consultation_items.consultation_id
                    AND c.status IN ('completed', 'superseded')
                    AND public.owner_posting_can(c.asset_posting_id, 'read')));

DROP POLICY IF EXISTS asset_auction_consultations_owner_read ON public.asset_auction_consultations;
CREATE POLICY asset_auction_consultations_owner_read ON public.asset_auction_consultations
  FOR SELECT TO authenticated
  USING (public.owner_posting_can(asset_posting_id, 'read'));

DROP POLICY IF EXISTS asset_auction_consult_proposals_owner_read ON public.asset_auction_consult_proposals;
CREATE POLICY asset_auction_consult_proposals_owner_read ON public.asset_auction_consult_proposals
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.asset_auction_consultations c
                  WHERE c.id = asset_auction_consult_proposals.consultation_id
                    AND c.status IN ('completed', 'superseded')
                    AND public.owner_posting_can(c.asset_posting_id, 'read')));

-- Hợp đồng mua bán: bên bán theo hồ sơ.
DROP POLICY IF EXISTS asc_party_read ON public.auction_sale_contracts;
CREATE POLICY asc_party_read ON public.auction_sale_contracts
  FOR SELECT TO authenticated
  USING (
    buyer_user_id = auth.uid()
    OR (seller_user_id IS NOT NULL
        AND public.sale_owner_seller_can(consignment_contract_id, seller_user_id, 'read'))
    OR public.can_manage_sale_contracts(organization_id, 'view')
  );

-- KYC tổ chức ĐÃ DUYỆT thuộc về không gian: người tạo (có thể đã rời đơn vị)
-- không được sửa tay / huỷ duyệt / xoá nữa. Sửa địa chỉ đi qua RPC.
DROP POLICY IF EXISTS asset_owner_org_kyc_own_rows ON public.asset_owner_org_kyc;

CREATE POLICY asset_owner_org_kyc_own_read ON public.asset_owner_org_kyc
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY asset_owner_org_kyc_own_insert ON public.asset_owner_org_kyc
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND status IN ('draft', 'pending_review'));

CREATE POLICY asset_owner_org_kyc_own_update ON public.asset_owner_org_kyc
  FOR UPDATE TO authenticated
  USING      (auth.uid() = created_by AND status <> 'approved')
  WITH CHECK (auth.uid() = created_by AND status IN ('draft', 'pending_review'));

CREATE POLICY asset_owner_org_kyc_own_delete ON public.asset_owner_org_kyc
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by AND status <> 'approved');

-- Storage.
-- Đồng nghiệp đọc giấy tờ của hồ sơ không gian.
CREATE POLICY asset_docs_posting_member_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'asset-docs' AND public.owner_asset_doc_readable(name));

-- Tệp đã tải lên là bất biến với chủ tài sản: giao diện không xoá/ghi đè, và cán
-- bộ đã rời đơn vị không được xoá giấy tờ sở hữu của ngân hàng trong thư mục mình.
DROP POLICY IF EXISTS asset_docs_owner_update  ON storage.objects;
DROP POLICY IF EXISTS asset_docs_owner_delete  ON storage.objects;
DROP POLICY IF EXISTS asset_media_owner_update ON storage.objects;
DROP POLICY IF EXISTS asset_media_owner_delete ON storage.objects;

-- File báo giá của tổ chức: chủ tài sản đọc theo hồ sơ.
DROP POLICY IF EXISTS quote_docs_read ON storage.objects;
CREATE POLICY quote_docs_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'quote-docs'
    AND EXISTS (
      SELECT 1 FROM public.asset_service_requests r
       WHERE r.id::text = (storage.foldername(objects.name))[2]
         AND (public.owner_posting_can(r.asset_posting_id, 'read')
              OR public.user_in_auction_org(r.auction_org_id)
              OR public.has_role(auth.uid(), 'ADMIN'::app_role))
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Thân hàm chép từ DB thật, CHỈ đổi dòng kiểm quyền (xem đầu file)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_asset_posting_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.admin_has_permission('tai-san-tu-nguyen', 'approve') THEN
    RETURN NEW;                                   -- admin có quyền duyệt: ghi thẳng
  END IF;

  -- Mọi người khác — kể cả chủ hồ sơ, kể cả admin chỉ có 'update' — không đổi
  -- được kết quả duyệt. Nuốt thay đổi thay vì RAISE: chủ tài sản sửa hồ sơ là
  -- việc hợp lệ, chỉ riêng phần kết luận duyệt là không được đụng vào.
  NEW.review_status    := OLD.review_status;
  NEW.reviewed_at      := OLD.reviewed_at;
  NEW.reviewed_by      := OLD.reviewed_by;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.review_notes     := OLD.review_notes;

  -- Sửa nội dung hồ sơ ĐÃ DUYỆT ⇒ phải duyệt lại. Không có nhánh này thì chủ
  -- tài sản được duyệt một lần rồi viết lại toàn bộ tài sản mà vẫn giữ dấu duyệt.
  -- branch_id không tính: đổi/xoá chi nhánh (FK SET NULL cũng là một UPDATE)
  -- là việc tổ chức nội bộ, không phải sửa nội dung tài sản.
  IF OLD.review_status = 'approved'
     AND (to_jsonb(NEW) - 'branch_id') IS DISTINCT FROM (to_jsonb(OLD) - 'branch_id') THEN
    NEW.review_status := 'pending';
    NEW.reviewed_at   := NULL;
    NEW.reviewed_by   := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.asset_postings_authentication_gate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reasons TEXT[];
  v_verdict TEXT;
BEGIN
  v_verdict := public._authentication_current_verdict(NEW.id);

  -- BR-GD-02: kết luận tiêu cực hiện hành ⇒ không đăng ở nhóm Cổ vật.
  IF NEW.parent_slug = 'co-vat-suu-tam' AND v_verdict IN ('inconclusive', 'suspected_fake') THEN
    RAISE EXCEPTION 'GD_FAILED_CATEGORY: Kết quả giám định không cho phép đăng tài sản này ở nhóm Cổ vật.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- BR-GD-03: bắt buộc giám định ⇒ chặn tới khi có chứng thư "xác thực".
  v_reasons := public._authentication_posting_reasons(NEW);
  IF cardinality(v_reasons) > 0 AND v_verdict IS DISTINCT FROM 'authentic' THEN
    RAISE EXCEPTION 'GD_REQUIRED: Tài sản này bắt buộc có chứng thư giám định trước khi nộp (%).',
      array_to_string(v_reasons, ', ')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.posting_authentication_state(_posting_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_p public.asset_postings%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM public.asset_postings WHERE id = _posting_id;
  IF NOT FOUND OR NOT (public.owner_posting_can(v_p.id, 'read')
                       OR public.admin_has_permission('tai-san-tu-nguyen', 'view')
                       OR public.admin_has_permission('don-giam-dinh', 'view')) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'reasons', to_jsonb(public._authentication_posting_reasons(v_p)),
    'verdict', public._authentication_current_verdict(v_p.id),
    'level', public.asset_posting_verification_level(v_p.id));
END;
$function$;

CREATE OR REPLACE FUNCTION public.asset_posting_verification_level(_posting_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.asset_authentication_orders o
                  WHERE o.asset_posting_id = p.id AND o.status = 'completed'
                    AND o.verdict = 'authentic' AND o.method IN ('ship_item', 'on_site')) THEN 4
    WHEN EXISTS (SELECT 1 FROM public.asset_authentication_orders o
                  WHERE o.asset_posting_id = p.id AND o.status = 'completed'
                    AND o.verdict = 'authentic') THEN 3
    WHEN p.review_status = 'approved' THEN 2
    -- Hồ sơ của không gian: KYC tổ chức của không gian, không phải của người tạo
    -- (cán bộ được mời thường không có KYC riêng).
    WHEN p.workspace_id IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.asset_owner_workspaces w
             JOIN public.asset_owner_org_kyc k ON k.id = w.org_kyc_id
            WHERE w.id = p.workspace_id AND k.status = 'approved') THEN 1
    WHEN p.workspace_id IS NULL AND (
           EXISTS (SELECT 1 FROM public.asset_owner_kyc k
                    WHERE k.user_id = p.user_id AND k.status = 'approved')
        OR EXISTS (SELECT 1 FROM public.asset_owner_org_kyc k
                    WHERE k.created_by = p.user_id AND k.status = 'approved')) THEN 1
    ELSE 0
  END
  FROM public.asset_postings p WHERE p.id = _posting_id;
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
   WHERE id = _posting_id AND public.owner_posting_can(id, 'write') FOR UPDATE;
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
   WHERE id = _posting_id AND public.owner_posting_can(id, 'write') FOR UPDATE;
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
   WHERE id = _posting_id AND public.owner_posting_can(id, 'write') FOR UPDATE;
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
   WHERE id = _posting_id AND public.owner_posting_can(id, 'write') FOR UPDATE;
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
   WHERE id = _posting_id AND public.owner_posting_can(id, 'write')
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
  IF NOT FOUND OR NOT public.owner_posting_can(v_scan.asset_posting_id, 'write') OR v_scan.partner <> 'mock' OR v_scan.scan_token <> _token THEN
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
   WHERE id = _order_id AND public.owner_posting_can(asset_posting_id, 'write') FOR UPDATE;
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
   WHERE id = _order_id AND public.owner_posting_can(asset_posting_id, 'write') FOR UPDATE;
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
   WHERE id = _consultation_id AND public.owner_posting_can(asset_posting_id, 'write') FOR UPDATE;
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
   WHERE id = _consultation_id AND public.owner_posting_can(asset_posting_id, 'write') FOR UPDATE;
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
   WHERE id = _consultation_id AND public.owner_posting_can(asset_posting_id, 'write') FOR UPDATE;
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
   WHERE id = _order_id AND public.owner_posting_can(asset_posting_id, 'write') FOR UPDATE;
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

CREATE OR REPLACE FUNCTION public.authentication_cert_readable(_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.admin_has_permission('don-giam-dinh', 'view')
      OR public.admin_has_permission('tai-san-tu-nguyen', 'view')
      OR EXISTS (SELECT 1 FROM public.asset_authentication_orders o
                  WHERE o.certificate_path = _name AND public.owner_posting_can(o.asset_posting_id, 'read'))
      OR EXISTS (SELECT 1 FROM public.asset_authentication_orders o
                   JOIN public.auction_session_items i ON i.asset_posting_id = o.asset_posting_id
                   JOIN public.auction_sessions s ON s.id = i.session_id AND s.status IN ('published', 'cancelled')
                  WHERE o.certificate_path = _name AND o.status = 'completed'
                    AND o.verdict = 'authentic' AND o.published_at IS NOT NULL);
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
   WHERE id = _request_id AND public.owner_posting_can(asset_posting_id, 'write');
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

CREATE OR REPLACE FUNCTION public.consignment_contract_confirm(_contract_id uuid, _side text, _signed_doc_path text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  c     public.consignment_contracts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF _side IS NULL OR _side NOT IN ('owner', 'org') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_side');
  END IF;

  SELECT * INTO c FROM public.consignment_contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT FOUND OR NOT public.consignment_contract_can_act(c.id, _side) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status <> 'awaiting_confirmation' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;
  IF _signed_doc_path IS DISTINCT FROM c.signed_doc_path THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'document_changed');
  END IF;

  IF _side = 'owner' AND c.owner_confirmed_at IS NULL THEN
    UPDATE public.consignment_contracts
       SET owner_confirmed_at = now(), owner_confirmed_by = v_uid
     WHERE id = c.id
    RETURNING * INTO c;
    INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data)
    VALUES (c.id, 'confirmed', 'owner', v_uid, jsonb_build_object('path', _signed_doc_path));
  ELSIF _side = 'org' AND c.org_confirmed_at IS NULL THEN
    UPDATE public.consignment_contracts
       SET org_confirmed_at = now(), org_confirmed_by = v_uid
     WHERE id = c.id
    RETURNING * INTO c;
    INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data)
    VALUES (c.id, 'confirmed', 'org', v_uid, jsonb_build_object('path', _signed_doc_path));
  END IF;

  IF c.owner_confirmed_at IS NOT NULL AND c.org_confirmed_at IS NOT NULL THEN
    UPDATE public.consignment_contracts
       SET status = 'signed', signed_at = now()
     WHERE id = c.id;
    INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data)
    VALUES (c.id, 'signed', _side, v_uid,
            jsonb_build_object('path', c.signed_doc_path, 'signed_date', c.signed_date));
    RETURN jsonb_build_object('ok', true, 'status', 'signed');
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', 'awaiting_confirmation');
END;
$function$;

CREATE OR REPLACE FUNCTION public.consignment_contract_attach_signed(_contract_id uuid, _side text, _signed_doc_path text, _signed_date date, _contract_no text DEFAULT NULL::text, _confirm boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     UUID := auth.uid();
  c         public.consignment_contracts%ROWTYPE;
  v_owner   JSONB;
  v_org     JSONB;
  v_missing TEXT[];
  v_reason  TEXT;
  v_now     TIMESTAMPTZ := now();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF _side IS NULL OR _side NOT IN ('owner', 'org') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_side');
  END IF;

  SELECT * INTO c FROM public.consignment_contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT FOUND OR NOT public.consignment_contract_can_act(c.id, _side) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status NOT IN ('drafting', 'awaiting_signatures', 'awaiting_confirmation') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;

  v_reason := public.consignment_contract_file_check(c.organization_id, c.id, _signed_doc_path, 'signed');
  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_reason);
  END IF;

  -- Ngày theo giờ Việt Nam: 6h sáng ở VN vẫn là hôm qua theo UTC.
  IF _signed_date IS NULL OR _signed_date > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_signed_date');
  END IF;

  v_owner   := public.consignment_posting_owner_party(c.asset_posting_id);
  v_org     := public.consignment_org_party(c.auction_org_id, c.organization_id);
  v_missing := public.consignment_missing_parties(v_owner, v_org);
  IF cardinality(v_missing) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'party_incomplete', 'missing', to_jsonb(v_missing));
  END IF;

  UPDATE public.consignment_contracts
     SET signed_doc_path      = _signed_doc_path,
         signed_uploaded_by   = v_uid,
         signed_uploaded_side = _side,
         signed_uploaded_at   = v_now,
         signed_date          = _signed_date,
         contract_no          = COALESCE(NULLIF(btrim(COALESCE(_contract_no, '')), ''), contract_no),
         owner_party          = v_owner,
         org_party            = v_org,
         asset_snapshot       = public.consignment_asset_snapshot(c.asset_posting_id),
         owner_confirmed_at   = CASE WHEN _confirm AND _side = 'owner' THEN v_now END,
         owner_confirmed_by   = CASE WHEN _confirm AND _side = 'owner' THEN v_uid END,
         org_confirmed_at     = CASE WHEN _confirm AND _side = 'org'   THEN v_now END,
         org_confirmed_by     = CASE WHEN _confirm AND _side = 'org'   THEN v_uid END,
         status               = 'awaiting_confirmation'
   WHERE id = c.id;

  INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data)
  VALUES (c.id, 'signed_uploaded', _side, v_uid,
          jsonb_build_object('path', _signed_doc_path, 'signed_date', _signed_date,
                             'previous_signed_path', c.signed_doc_path));
  IF _confirm THEN
    INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data)
    VALUES (c.id, 'confirmed', _side, v_uid, jsonb_build_object('path', _signed_doc_path));
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', 'awaiting_confirmation');
END;
$function$;

CREATE OR REPLACE FUNCTION public.consignment_contract_cancel(_contract_id uuid, _side text, _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid             UUID := auth.uid();
  v_reason          TEXT := btrim(COALESCE(_reason, ''));
  v_posting_id      UUID;
  c                 public.consignment_contracts%ROWTYPE;
  v_stage           TEXT;
  v_crm_warning     TEXT;
  v_reopened        INT;
  v_reopened_quoted INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF _side IS NULL OR _side NOT IN ('owner', 'org') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_side');
  END IF;

  SELECT asset_posting_id INTO v_posting_id FROM public.consignment_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  PERFORM public.lock_asset_posting_consignment(v_posting_id);

  SELECT * INTO c FROM public.consignment_contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT public.consignment_contract_can_act(c.id, _side) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status = 'signed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_signed');
  END IF;
  IF c.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_cancelled');
  END IF;
  IF char_length(v_reason) < 10 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'reason_required');
  END IF;
  -- Chỉ lô cũ (trước khi có cổng hợp đồng) mới lọt vào đây.
  IF EXISTS (SELECT 1 FROM public.auction_session_items i
               JOIN public.auction_sessions s ON s.id = i.session_id
              WHERE i.service_request_id = c.service_request_id AND s.status <> 'cancelled') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'in_auction_session');
  END IF;

  UPDATE public.consignment_contracts
     SET status = 'cancelled', cancel_reason = v_reason, cancelled_side = _side,
         cancelled_by = v_uid, cancelled_at = now()
   WHERE id = c.id;

  UPDATE public.asset_service_requests
     SET status = 'contract_cancelled'
   WHERE id = c.service_request_id AND status IN ('selected', 'accepted');

  WITH reopened AS (
    UPDATE public.asset_service_requests r
       SET status = CASE
             WHEN r.status_before_close = 'quoted' AND r.quoted_at IS NOT NULL THEN 'quoted'
             WHEN r.status_before_close IN ('quoted', 'seen') AND r.seen_at IS NOT NULL THEN 'seen'
             WHEN r.status_before_close IS NULL AND r.quoted_at IS NOT NULL THEN 'quoted'
             WHEN r.status_before_close IS NULL AND r.seen_at IS NOT NULL THEN 'seen'
             ELSE 'sent'
           END,
           closed_by_request_id = NULL,
           status_before_close  = NULL,
           reopened_at          = now()
     WHERE r.closed_by_request_id = c.service_request_id
       AND r.status = 'not_selected'
    RETURNING r.status
  )
  SELECT count(*), count(*) FILTER (WHERE status = 'quoted')
    INTO v_reopened, v_reopened_quoted
    FROM reopened;

  UPDATE public.asset_broker_requests b
     SET selected_request_id = NULL,
         status = CASE WHEN EXISTS (SELECT 1 FROM public.asset_service_requests x
                                     WHERE x.asset_posting_id = b.asset_posting_id AND x.status = 'quoted')
                       THEN 'quoted' ELSE 'sourcing' END
   WHERE b.selected_request_id = c.service_request_id AND b.status = 'selected';

  IF c.opportunity_id IS NOT NULL THEN
    SELECT stage INTO v_stage FROM public.opportunities WHERE id = c.opportunity_id;
    IF v_stage IN ('selling', 'pending_approval') THEN
      UPDATE public.opportunities
         SET stage = 'lost',
             lost_reason = 'Huỷ hợp đồng ký gửi ('
                           || CASE WHEN _side = 'owner' THEN 'chủ tài sản' ELSE 'tổ chức đấu giá' END
                           || '): ' || v_reason,
             closed_at = now()
       WHERE id = c.opportunity_id;
    ELSIF v_stage = 'won' THEN
      v_crm_warning := 'opportunity_won';
    END IF;
  END IF;

  INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data)
  VALUES (c.id, 'cancelled', _side, v_uid,
          jsonb_build_object('reason', v_reason, 'reopened', v_reopened,
                             'reopened_quoted', v_reopened_quoted, 'crm_warning', v_crm_warning));

  RETURN jsonb_build_object('ok', true, 'reopened', v_reopened,
                            'reopened_quoted', v_reopened_quoted, 'crm_warning', v_crm_warning);
END;
$function$;

CREATE OR REPLACE FUNCTION public.consignment_contract_share_draft(_contract_id uuid, _draft_doc_path text, _generated boolean DEFAULT false, _contract_no text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid     UUID := auth.uid();
  c         public.consignment_contracts%ROWTYPE;
  v_owner   JSONB;
  v_org     JSONB;
  v_missing TEXT[];
  v_reason  TEXT;
  v_cleared BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO c FROM public.consignment_contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT FOUND OR NOT public.consignment_can_act(c.owner_user_id, c.auction_org_id, c.organization_id, 'org') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF c.status NOT IN ('drafting', 'awaiting_signatures', 'awaiting_confirmation') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_status');
  END IF;

  v_reason := public.consignment_contract_file_check(c.organization_id, c.id, _draft_doc_path, 'draft');
  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_reason);
  END IF;

  v_owner   := public.consignment_posting_owner_party(c.asset_posting_id);
  v_org     := public.consignment_org_party(c.auction_org_id, c.organization_id);
  v_missing := public.consignment_missing_parties(v_owner, v_org);
  IF cardinality(v_missing) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'party_incomplete', 'missing', to_jsonb(v_missing));
  END IF;

  v_cleared := c.signed_doc_path IS NOT NULL;

  UPDATE public.consignment_contracts
     SET draft_doc_path       = _draft_doc_path,
         draft_source         = CASE WHEN _generated THEN 'generated' ELSE 'uploaded' END,
         draft_uploaded_by    = v_uid,
         draft_uploaded_at    = now(),
         contract_no          = COALESCE(NULLIF(btrim(COALESCE(_contract_no, '')), ''), contract_no),
         owner_party          = v_owner,
         org_party            = v_org,
         asset_snapshot       = public.consignment_asset_snapshot(c.asset_posting_id),
         signed_doc_path      = NULL,
         signed_uploaded_by   = NULL,
         signed_uploaded_side = NULL,
         signed_uploaded_at   = NULL,
         signed_date          = NULL,
         owner_confirmed_at   = NULL,
         owner_confirmed_by   = NULL,
         org_confirmed_at     = NULL,
         org_confirmed_by     = NULL,
         status               = 'awaiting_signatures'
   WHERE id = c.id;

  INSERT INTO public.consignment_contract_events (contract_id, action, side, actor_id, data)
  VALUES (c.id, 'draft_shared', 'org', v_uid,
          jsonb_build_object('path', _draft_doc_path, 'generated', _generated,
                             'cleared_signed', v_cleared, 'previous_signed_path', c.signed_doc_path));

  RETURN jsonb_build_object('ok', true, 'status', 'awaiting_signatures', 'cleared_signed', v_cleared);
END;
$function$;

CREATE OR REPLACE FUNCTION public.org_consignment_contract(_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ao      UUID;
  c         public.consignment_contracts%ROWTYPE;
  v_open    BOOLEAN;
  v_owner   JSONB;
  v_orgp    JSONB;
  v_asset   JSONB;
  v_docs    TEXT[] := '{}';
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT auction_org_id INTO v_ao FROM public.asset_service_requests WHERE id = _request_id;
  IF NOT FOUND OR NOT public.user_in_auction_org(v_ao) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO c FROM public.consignment_contracts WHERE service_request_id = _request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_contract');
  END IF;

  v_open := c.status IN ('drafting', 'awaiting_signatures', 'awaiting_confirmation');

  IF c.status = 'signed' THEN
    v_owner := c.owner_party;
    v_orgp  := c.org_party;
    v_asset := c.asset_snapshot;
  ELSIF v_open THEN
    v_owner := public.consignment_posting_owner_party(c.asset_posting_id);
    v_orgp  := public.consignment_org_party(c.auction_org_id, c.organization_id);
    v_asset := public.consignment_asset_snapshot(c.asset_posting_id);
  ELSE
    v_orgp := c.org_party;   -- đã huỷ: không còn thấy chủ tài sản
  END IF;

  IF c.status <> 'cancelled' THEN
    SELECT COALESCE(p.ownership_proof_urls, '{}') || COALESCE(p.doc_urls, '{}')
      INTO v_docs FROM public.asset_postings p WHERE p.id = c.asset_posting_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'contract', (to_jsonb(c)
                  - ARRAY['owner_party', 'asset_snapshot', 'draft_uploaded_by', 'signed_uploaded_by',
                          'owner_confirmed_by', 'org_confirmed_by', 'cancelled_by', 'opportunity_id'])
                || jsonb_build_object('org_party', v_orgp, 'owner_party', NULL, 'asset_snapshot', NULL),
    'owner_party', v_owner,
    'asset', v_asset,
    'ownership_doc_paths', to_jsonb(COALESCE(v_docs, '{}')),
    'events', (SELECT COALESCE(jsonb_agg(jsonb_build_object('action', e.action, 'side', e.side,
                                                            'created_at', e.created_at, 'data', e.data)
                                         ORDER BY e.created_at), '[]'::jsonb)
                 FROM public.consignment_contract_events e WHERE e.contract_id = c.id),
    'can_act', public.consignment_can_act(c.owner_user_id, c.auction_org_id, c.organization_id, 'org'),
    'missing', to_jsonb(CASE WHEN v_open THEN public.consignment_missing_parties(v_owner, v_orgp)
                             ELSE '{}'::text[] END)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_upload_consignment_contract_file(_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.consignment_contracts c
     WHERE c.id = public.consignment_path_uuid(_name, 2)
       AND c.organization_id = public.consignment_path_uuid(_name, 1)
       AND c.status IN ('drafting', 'awaiting_signatures', 'awaiting_confirmation')
       AND (public.consignment_contract_can_act(c.id, 'owner')
            OR public.consignment_contract_can_act(c.id, 'org'))
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_read_consignment_contract_file(_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.consignment_contracts c
     WHERE c.id = public.consignment_path_uuid(_name, 2)
       AND c.organization_id = public.consignment_path_uuid(_name, 1)
       AND (public.owner_posting_can(c.asset_posting_id, 'read')
            OR public.has_role(auth.uid(), 'ADMIN'::app_role)
            -- Tổ chức mất quyền đọc khi hợp đồng bị huỷ.
            OR (c.status <> 'cancelled' AND public.user_in_auction_org(c.auction_org_id)))
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_read_asset_doc_for_contract(_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM public.consignment_contracts c
      JOIN public.asset_postings p ON p.id = c.asset_posting_id
     WHERE c.status <> 'cancelled'
       AND public.owner_posting_file_owner_ok(p.workspace_id, p.user_id,
                                             public.consignment_path_uuid(_name, 1))
       AND _name = ANY (COALESCE(p.ownership_proof_urls, '{}') || COALESCE(p.doc_urls, '{}'))
       AND public.user_in_auction_org(c.auction_org_id)
  );
$function$;

CREATE OR REPLACE FUNCTION public.sale_seller_snapshot(_lot_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE it RECORD; cc RECORD; ao RECORD; v_party JSONB;
BEGIN
  SELECT i.id, i.source, i.listing_id, i.service_request_id INTO it
    FROM public.auction_session_items i WHERE i.id = _lot_id;
  IF it.id IS NULL THEN RETURN NULL; END IF;

  IF it.source = 'posting' THEN
    -- Hợp đồng ký gửi đã huỷ thì `owner_party` không còn dùng được (RPC tổ
    -- chức cũng giấu nó) ⇒ coi như không có bên bán.
    SELECT c.id, c.owner_user_id, c.owner_party, c.asset_posting_id INTO cc
      FROM public.consignment_contracts c
     WHERE c.service_request_id = it.service_request_id AND c.status <> 'cancelled'
     ORDER BY c.created_at DESC LIMIT 1;
    IF cc.id IS NULL OR cc.owner_user_id IS NULL THEN RETURN NULL; END IF;
    v_party := COALESCE(NULLIF(cc.owner_party, '{}'::jsonb), public.consignment_posting_owner_party(cc.asset_posting_id));
    RETURN jsonb_build_object(
      'seller_kind', 'owner_user',
      'seller_user_id', cc.owner_user_id,
      'consignment_contract_id', cc.id,
      'seller_party', COALESCE(v_party, '{}'::jsonb));
  END IF;

  -- Lô tin đăng: chủ tài sản chỉ là thực thể danh bạ, KHÔNG có tài khoản.
  SELECT o.id, o.name, o.address, o.owner_kind INTO ao
    FROM public.listings l JOIN public.asset_owners o ON o.id = l.asset_owner_id
   WHERE l.id = it.listing_id;
  IF ao.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'seller_kind', 'org_on_behalf',
    'seller_asset_owner_id', ao.id,
    'seller_party', jsonb_build_object(
      'kind', 'registry', 'name', ao.name, 'address', ao.address, 'owner_kind', ao.owner_kind));
END; $function$;

CREATE OR REPLACE FUNCTION public.sale_can_act(_contract_id uuid, _side text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE _side
    WHEN 'buyer'  THEN c.buyer_user_id IS NOT NULL AND c.buyer_user_id = auth.uid()
    WHEN 'seller' THEN (c.seller_kind = 'owner_user'
                        AND public.sale_owner_seller_can(c.consignment_contract_id, c.seller_user_id, 'write'))
                    OR (c.seller_kind = 'org_on_behalf' AND public.can_manage_sale_contracts(c.organization_id, 'update'))
    WHEN 'org'    THEN public.can_manage_sale_contracts(c.organization_id, 'update')
    ELSE false END
  FROM public.auction_sale_contracts c WHERE c.id = _contract_id
$function$;

CREATE OR REPLACE FUNCTION public.sale_contract_visible(_contract_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.auction_sale_contracts c
     WHERE c.id = _contract_id
       AND (c.buyer_user_id = auth.uid()
         OR (c.seller_user_id IS NOT NULL
             AND public.sale_owner_seller_can(c.consignment_contract_id, c.seller_user_id, 'read'))
         OR public.can_manage_sale_contracts(c.organization_id, 'view')
         OR public.has_role(auth.uid(), 'ADMIN'::app_role)))
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
                          AND NOT public.owner_ws_can(w.id, 'manage_workspace'))
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


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Tóm tắt "việc cần làm" theo TENANT (đổi chữ ký ⇒ DROP + CREATE)
--    p_workspace_id NULL = hồ sơ cá nhân của người gọi; có = hồ sơ của không gian.
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.owner_consignment_summary();

-- SECURITY DEFINER + kiểm quyền tường minh: cần đọc Bên A (KYC tổ chức của không
-- gian) mà RLS của asset_owner_org_kyc chỉ cho người tạo. owner_action chỉ có với
-- người GHI được hồ sơ (Người xem không có việc để làm).
CREATE FUNCTION public.owner_consignment_summary(p_workspace_id UUID DEFAULT NULL)
RETURNS TABLE(posting_id uuid, quoted_count integer, has_selection boolean,
              contract_id uuid, contract_status text, owner_action text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT p.id,
           public.owner_posting_row_can(p.workspace_id, p.branch_id, p.user_id, 'write') AS can_write,
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
$$;

DROP FUNCTION IF EXISTS public.owner_sale_contract_summary();

CREATE FUNCTION public.owner_sale_contract_summary(p_workspace_id UUID DEFAULT NULL)
RETURNS TABLE(contract_id uuid, code text, status text, stage text, owner_action text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.code, c.status, public.sale_contract_stage(c),
         CASE
           WHEN NOT public.sale_owner_seller_can(c.consignment_contract_id, c.seller_user_id, 'write') THEN 'none'
           WHEN c.status = 'awaiting_confirmation' AND c.seller_confirmed_at IS NULL THEN 'confirm_signed'
           WHEN c.status = 'signed' AND c.paid_at IS NOT NULL
                AND c.handover_seller_confirmed_at IS NULL THEN 'confirm_handover'
           ELSE 'none' END
    FROM public.auction_sale_contracts c
    LEFT JOIN public.consignment_contracts cc ON cc.id = c.consignment_contract_id
    LEFT JOIN public.asset_postings p ON p.id = cc.asset_posting_id
   WHERE c.seller_kind = 'owner_user'
     AND public.sale_owner_seller_can(c.consignment_contract_id, c.seller_user_id, 'read')
     AND CASE WHEN p_workspace_id IS NULL THEN p.workspace_id IS NULL
              ELSE p.workspace_id = p_workspace_id END
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Địa chỉ Bên A theo hồ sơ + sửa địa chỉ trụ sở của không gian
-- ═══════════════════════════════════════════════════════════════════════════

-- Chỉ trả phần ĐỊA CHỈ (không CCCD / MST) — thành viên đọc được mà không cần
-- quyền đọc bảng KYC. can_edit: cá nhân = người tạo; không gian = Trưởng đơn vị.
CREATE OR REPLACE FUNCTION public.owner_posting_party_address(p_posting_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
                  ELSE public.owner_ws_can(p.workspace_id, 'manage_workspace') AND v ->> 'kind' = 'organization'
                END);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_ws_update_org_address(
  p_workspace_id UUID, _address TEXT, _province TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_address  TEXT := NULLIF(btrim(COALESCE(_address, '')), '');
  v_province TEXT := NULLIF(btrim(COALESCE(_province, '')), '');
  v_id       UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  IF NOT public.owner_ws_can(p_workspace_id, 'manage_workspace') THEN
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
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. Huỷ "nhờ sàn chọn giúp" — thay cho policy UPDATE cũ (cho đổi mọi cột).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.owner_cancel_broker_request(_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.asset_broker_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;
  SELECT * INTO r FROM public.asset_broker_requests
   WHERE id = _request_id AND public.owner_posting_can(asset_posting_id, 'write')
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
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. Kết quả phiên tự khai (Phase 6/8) gắn hồ sơ số hoá phải CÙNG không gian.
--     Trigger riêng — không đụng owner_asset_outcomes_guard / _guard_scope.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.owner_asset_outcomes_guard_posting()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.asset_posting_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.asset_postings p
        WHERE p.id = NEW.asset_posting_id AND p.workspace_id = NEW.workspace_id) THEN
    RAISE EXCEPTION 'OUTCOME_POSTING_WORKSPACE: Hồ sơ số hoá không thuộc không gian này.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER owner_asset_outcomes_guard_posting
  BEFORE INSERT OR UPDATE OF asset_posting_id, workspace_id ON public.owner_asset_outcomes
  FOR EACH ROW EXECUTE FUNCTION public.owner_asset_outcomes_guard_posting();

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. Quyền EXECUTE
--   • Hàm gọi THẲNG trong policy (TO authenticated) ⇒ authenticated phải EXECUTE.
--   • Hàm nội bộ (chỉ gọi từ hàm SECURITY DEFINER / trigger) ⇒ thu hồi hết.
--   • RPC ⇒ authenticated.
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE ALL ON FUNCTION public.owner_posting_row_can(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_posting_can(UUID, TEXT)                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_asset_doc_readable(TEXT)                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sale_owner_seller_can(UUID, UUID, TEXT)        FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_posting_row_can(UUID, UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_posting_can(UUID, TEXT)                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_asset_doc_readable(TEXT)                 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sale_owner_seller_can(UUID, UUID, TEXT)        TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.owner_posting_file_owner_ok(UUID, UUID, UUID)       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consignment_contract_can_act(UUID, TEXT)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consignment_posting_owner_party(UUID)                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._authentication_posting_reasons(public.asset_postings) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.asset_postings_owner_guard()                         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_asset_outcomes_guard_posting()                 FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.owner_consignment_summary(UUID)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_sale_contract_summary(UUID)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_posting_party_address(UUID)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_ws_update_org_address(UUID, TEXT, TEXT)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_cancel_broker_request(UUID)              FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_consignment_summary(UUID)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_sale_contract_summary(UUID)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_posting_party_address(UUID)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_ws_update_org_address(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_cancel_broker_request(UUID)             TO authenticated;
