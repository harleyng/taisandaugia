-- Trang chi tiết hợp đồng ký gửi trong menu "Hợp đồng" của cổng tổ chức
-- (/portal/hop-dong/ky-gui/:contractId) mở theo id HỢP ĐỒNG, còn
-- org_consignment_contract nhận id YÊU CẦU. Hàm này chỉ tra yêu cầu của hợp đồng
-- rồi gọi lại org_consignment_contract — cùng luật hiện danh tính, cùng kiểm
-- user_in_auction_org — và trả thêm `request_id` để trang làm mới đúng cache.
-- Không thêm dữ liệu nào ngoài bản chiếu đã có.

CREATE OR REPLACE FUNCTION public.org_consignment_contract_by_id(_contract_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_req UUID;
  v_res JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  SELECT service_request_id INTO v_req FROM public.consignment_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  v_res := public.org_consignment_contract(v_req);
  IF COALESCE((v_res->>'ok')::boolean, false) THEN
    v_res := v_res || jsonb_build_object('request_id', v_req);
  END IF;
  RETURN v_res;
END;
$function$;

REVOKE ALL ON FUNCTION public.org_consignment_contract_by_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_consignment_contract_by_id(uuid) TO authenticated;
