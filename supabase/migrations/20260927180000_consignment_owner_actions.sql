-- Ký gửi đấu giá (thiết kế "Ky Gui Dau Gia - Danh sach & Chi tiet"): "Cần bạn xử
-- lý" gồm cả hồ sơ CHƯA GỬI tổ chức nào và hồ sơ mà MỌI tổ chức đã từ chối — hai
-- lượt đó cũng là của chủ tài sản. Người dùng chốt: số trên menu đếm đúng tập này.
--
-- Thêm hai owner_action ở mức ưu tiên THẤP NHẤT (không chồng lên việc hợp đồng /
-- chọn báo giá):
--   add_orgs  — đã gửi, không còn yêu cầu sống, không nhờ sàn đang mở, chưa chốt.
--   send_orgs — hồ sơ đã duyệt, chưa gửi ai, không nhờ sàn đang mở.
-- Luật nhân bản consignmentStageOf (src/lib/consignment/ownerConsignment.ts) —
-- sửa một bên phải sửa bên kia.
--
-- Thân hàm lấy từ bản đang chạy (sau 20260927170100_owner_ws_rbac_enforce: quyền
-- ghi = ky-gui:update); RETURNS TABLE giữ nguyên nên CREATE OR REPLACE được.

CREATE OR REPLACE FUNCTION public.owner_consignment_summary(p_workspace_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(posting_id uuid, quoted_count integer, has_selection boolean, contract_id uuid, contract_status text, owner_action text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT p.id,
           p.status AS posting_status,
           p.review_status,
           public.owner_posting_row_can(p.workspace_id, p.branch_id, p.user_id, 'ky-gui', 'update') AS can_write,
           (SELECT count(*)::int FROM public.asset_service_requests r
             WHERE r.asset_posting_id = p.id AND r.status = 'quoted') AS quoted_count,
           EXISTS (SELECT 1 FROM public.asset_service_requests r
                    WHERE r.asset_posting_id = p.id AND r.status IN ('selected', 'accepted')) AS has_selection,
           (SELECT count(*)::int FROM public.asset_service_requests r
             WHERE r.asset_posting_id = p.id) AS request_count,
           EXISTS (SELECT 1 FROM public.asset_service_requests r
                    WHERE r.asset_posting_id = p.id
                      AND r.status IN ('sent', 'seen', 'quoted', 'accepted', 'selected')) AS has_live_request,
           EXISTS (SELECT 1 FROM public.asset_broker_requests br
                    WHERE br.asset_posting_id = p.id
                      AND br.status IN ('pending', 'sourcing', 'quoted')) AS broker_open,
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
           -- Hai lượt "tìm tổ chức" chỉ khi hồ sơ chưa rời luồng (chưa chốt, chưa hợp đồng).
           WHEN b.contract_id IS NOT NULL OR b.has_selection OR b.broker_open
                OR b.posting_status IN ('draft', 'cancelled', 'matched', 'contracted')
             THEN NULL
           WHEN b.request_count > 0 AND NOT b.has_live_request
             THEN 'add_orgs'
           WHEN b.request_count = 0 AND b.posting_status = 'active' AND b.review_status = 'approved'
             THEN 'send_orgs'
         END
    FROM base b;
$function$;
