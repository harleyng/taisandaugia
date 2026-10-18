-- Một tài khoản KYC được NHIỀU tổ chức chủ tài sản (mỗi hồ sơ duyệt = 1 Trạm riêng).
--
--  • Bỏ UNIQUE(created_by). Không giới hạn số hồ sơ đang dở (nháp / chờ duyệt / bị từ chối).
--  • Cùng tài khoản không khai trùng mã số thuế ở hai hồ sơ còn hiệu lực (bị từ chối thì nộp lại được).
--    Tài khoản khác nhau vẫn trùng MST được như trước.
--  • Bên A của hợp đồng đã lấy theo Trạm của hồ sơ số hoá (consignment_posting_owner_party) ⇒ không đổi.
--  • owner_update_kyc_address: nhánh tổ chức trước sửa MỌI hồ sơ của người tạo ⇒ nay bắt buộc chỉ đích danh.

ALTER TABLE public.asset_owner_org_kyc DROP CONSTRAINT asset_owner_org_kyc_created_by_unique;

CREATE INDEX IF NOT EXISTS idx_asset_owner_org_kyc_created_by
  ON public.asset_owner_org_kyc (created_by, created_at DESC);

CREATE UNIQUE INDEX asset_owner_org_kyc_user_tax_code_uq
  ON public.asset_owner_org_kyc (created_by, btrim(tax_code))
  WHERE status <> 'rejected' AND tax_code IS NOT NULL AND btrim(tax_code) <> '';

-- Đổi chữ ký ⇒ phải DROP rồi tạo lại.
DROP FUNCTION public.owner_update_kyc_address(text, text, text, text);

CREATE FUNCTION public.owner_update_kyc_address(
  _kind text, _address text, _ward text DEFAULT NULL, _province text DEFAULT NULL,
  _org_kyc_id uuid DEFAULT NULL)
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
    -- Một tài khoản có thể có nhiều hồ sơ tổ chức ⇒ phải chỉ đích danh hồ sơ.
    IF _org_kyc_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'org_kyc_required');
    END IF;
    -- KYC tổ chức đã sinh không gian thuộc về KHÔNG GIAN: người tạo đã rời đơn vị
    -- không được sửa địa chỉ Bên A của mọi hợp đồng sau này. Đường sửa cho
    -- Trưởng đơn vị là owner_ws_update_org_address.
    UPDATE public.asset_owner_org_kyc k
       SET head_office_address = v_address, head_office_province = v_province
     WHERE k.id = _org_kyc_id
       AND k.created_by = v_uid
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

REVOKE EXECUTE ON FUNCTION public.owner_update_kyc_address(text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_update_kyc_address(text, text, text, text, uuid) TO authenticated;
