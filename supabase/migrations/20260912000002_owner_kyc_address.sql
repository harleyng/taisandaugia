-- Địa chỉ pháp lý của chủ tài sản — lưu VĨNH VIỄN trên hồ sơ KYC
--
-- Hợp đồng dịch vụ đấu giá tài sản cần địa chỉ của Bên A (chủ tài sản), nhưng
-- KYC chủ tài sản chưa từng có cột địa chỉ. Quyết định: lưu trên KYC để mọi hợp
-- đồng sau dùng lại, KHÔNG nhập lại theo từng hợp đồng.
--
-- Địa chỉ không phải trường được thẩm định KYC (không đối chiếu giấy tờ) nên chủ
-- tài sản tự sửa được cả SAU khi đã duyệt — qua RPC chỉ chạm đúng các cột địa
-- chỉ. Không nới policy own_rows: policy đó chặn UPDATE sau 'approved', nới ra là
-- mở luôn họ tên / số CCCD.
--
-- Trigger asset_owner_org_kyc_approve chỉ bắt `UPDATE OF status` nên đổi địa chỉ
-- không chạy lại việc khớp tài sản.

ALTER TABLE public.asset_owner_kyc
  ADD COLUMN IF NOT EXISTS address  TEXT,
  ADD COLUMN IF NOT EXISTS ward     TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT;

ALTER TABLE public.asset_owner_org_kyc
  ADD COLUMN IF NOT EXISTS head_office_address  TEXT,
  ADD COLUMN IF NOT EXISTS head_office_province TEXT;

COMMENT ON COLUMN public.asset_owner_kyc.address IS
  'Địa chỉ thường trú / liên hệ — Bên A trong hợp đồng dịch vụ đấu giá. Sửa được sau duyệt qua owner_update_kyc_address.';
COMMENT ON COLUMN public.asset_owner_org_kyc.head_office_address IS
  'Địa chỉ trụ sở — Bên A trong hợp đồng dịch vụ đấu giá. Sửa được sau duyệt qua owner_update_kyc_address.';

CREATE OR REPLACE FUNCTION public.owner_update_kyc_address(
  _kind     TEXT,
  _address  TEXT,
  _ward     TEXT DEFAULT NULL,
  _province TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
    UPDATE public.asset_owner_org_kyc
       SET head_office_address = v_address, head_office_province = v_province
     WHERE created_by = v_uid
    RETURNING id INTO v_id;
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
$$;

GRANT EXECUTE ON FUNCTION public.owner_update_kyc_address(TEXT, TEXT, TEXT, TEXT) TO authenticated;
