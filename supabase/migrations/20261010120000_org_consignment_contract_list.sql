-- Menu "Hợp đồng" của cổng tổ chức: danh sách hợp đồng ký gửi của MỘT tổ chức.
--
-- Trước đây tổ chức chỉ thấy hợp đồng ký gửi bên trong từng yêu cầu
-- (org_consignment_contract theo _request_id). Danh sách gộp cần một dòng mỗi
-- hợp đồng + cờ "tổ chức đang phải làm gì".
--
-- Tổ chức KHÔNG có policy đọc consignment_contracts (dòng chứa CCCD / địa chỉ
-- chủ tài sản) ⇒ SECURITY DEFINER và chỉ trả TÊN bên A, theo đúng luật hiện
-- danh tính của org_consignment_contract: đã ký → bản chụp; đang mở → đọc sống;
-- đã huỷ → không còn thấy chủ tài sản.
--
-- `org_action` nhân bản luật đếm `contracts_action` của
-- org_service_request_counts (20260912000007) — sửa một bên phải sửa bên kia,
-- nếu không số trên menu lệch với các dòng "Cần xử lý".

CREATE OR REPLACE FUNCTION public.org_consignment_contract_list(_auction_org_id uuid)
RETURNS TABLE (
  id                 uuid,
  code               text,
  contract_no        text,
  status             text,
  service_request_id uuid,
  posting_code       text,
  title              text,
  child_slug         text,
  owner_name         text,
  service_fee        numeric,
  created_at         timestamptz,
  signed_at          timestamptz,
  updated_at         timestamptz,
  org_action         text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.user_in_auction_org(_auction_org_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT c.id, c.code, c.contract_no, c.status, c.service_request_id,
         p.code,
         COALESCE(c.asset_snapshot->>'title', p.title),
         COALESCE(c.asset_snapshot->>'child_slug', p.child_slug),
         CASE
           WHEN c.status = 'signed' THEN COALESCE(c.owner_party->>'org_name', c.owner_party->>'full_name')
           WHEN c.status = 'cancelled' THEN NULL
           ELSE (SELECT COALESCE(o->>'org_name', o->>'full_name')
                   FROM (SELECT public.consignment_posting_owner_party(c.asset_posting_id) AS o) x)
         END,
         NULLIF(c.terms->>'service_fee', '')::numeric,
         c.created_at, c.signed_at, c.updated_at,
         CASE
           WHEN c.status = 'drafting' THEN 'share_draft'
           WHEN c.status = 'awaiting_signatures' THEN 'attach_signed'
           WHEN c.status = 'awaiting_confirmation' AND c.org_confirmed_at IS NULL THEN 'confirm'
           ELSE NULL
         END
    FROM public.consignment_contracts c
    JOIN public.asset_postings p ON p.id = c.asset_posting_id
   WHERE c.auction_org_id = _auction_org_id
   ORDER BY c.updated_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.org_consignment_contract_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_consignment_contract_list(uuid) TO authenticated;
