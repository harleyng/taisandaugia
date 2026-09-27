-- Nhập tài sản từ Excel (menu "Số hoá tài sản").
--
-- Mỗi dòng hợp lệ ⇒ MỘT hồ sơ NHÁP (status 'draft'); ảnh + giấy tờ bổ sung sau
-- trong wizard. Phân loại dòng ở client (src/lib/asset-posting/postingImport.ts);
-- RPC này chỉ ghi, mỗi dòng một savepoint, lỗi dòng nào báo dòng đó.
--
-- SECURITY INVOKER: policy asset_postings_owner_insert (so-hoa:create + phạm vi
-- chi nhánh), guard duyệt, cổng giám định (chỉ khi 'active' — nháp không chạm) và
-- mã HS-xxxx mặc định áp y như khi lưu nháp từ wizard. Các cột người dùng KHÔNG
-- được chọn (user_id, workspace_id, status, review_*, mảng tệp) do hàm ép.

CREATE OR REPLACE FUNCTION public.owner_import_postings(p_workspace_id UUID, p_rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = public
AS $$
DECLARE
  v_row   JSONB;
  v_ord   BIGINT;
  v_id    UUID;
  v_code  TEXT;
  v_out   JSONB := '[]'::jsonb;
  v_state TEXT;
  v_msg   TEXT;
  v_con   TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_workspace_id IS NOT NULL AND NOT public.owner_ws_has(p_workspace_id, 'so-hoa', 'create') THEN
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
      INSERT INTO public.asset_postings (
        user_id, workspace_id, branch_id, status,
        parent_slug, child_slug, title, description,
        province, district, ward, address,
        pricing_mode, starting_price, auction_format,
        has_dispute, has_mortgage, is_seized, legal_notes,
        delta_fields
      ) VALUES (
        auth.uid(),
        p_workspace_id,
        CASE WHEN p_workspace_id IS NOT NULL THEN NULLIF(v_row->>'branch_id', '')::uuid END,
        'draft',
        v_row->>'parent_slug',
        v_row->>'child_slug',
        btrim(v_row->>'title'),
        NULLIF(v_row->>'description', ''),
        NULLIF(v_row->>'province', ''),
        NULLIF(v_row->>'district', ''),
        NULLIF(v_row->>'ward', ''),
        NULLIF(v_row->>'address', ''),
        'self',
        NULLIF(v_row->>'starting_price', '')::numeric,
        COALESCE(NULLIF(v_row->>'auction_format', ''), 'truc_tiep'),
        (v_row->>'has_dispute')::boolean,
        (v_row->>'has_mortgage')::boolean,
        (v_row->>'is_seized')::boolean,
        NULLIF(v_row->>'legal_notes', ''),
        CASE WHEN jsonb_typeof(v_row->'delta_fields') = 'object' THEN v_row->'delta_fields' ELSE '{}'::jsonb END
      )
      RETURNING id, code INTO v_id, v_code;
      v_out := v_out || jsonb_build_array(jsonb_build_object('idx', v_ord - 1, 'ok', true, 'id', v_id, 'posting_code', v_code));
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT, v_con = CONSTRAINT_NAME;
      v_out := v_out || jsonb_build_array(jsonb_build_object(
        'idx', v_ord - 1, 'ok', false, 'code', v_state, 'message', v_msg,
        'constraint', NULLIF(v_con, '')));
    END;
  END LOOP;

  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_import_postings(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_import_postings(UUID, JSONB) TO authenticated;
