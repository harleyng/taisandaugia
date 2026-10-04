-- Hồ sơ hoàn chỉnh — Phase 3 (docs/owner-dossier-plan.md): điểm + mức cho DANH SÁCH hồ sơ.
--
-- Danh sách hồ sơ số hoá / bảng Tài sản cần huy hiệu mức cho từng dòng. Gọi
-- asset_posting_dossier_trust từng hồ sơ là N lượt gọi mỗi trang ⇒ một RPC nhận mảng id,
-- dùng lại _dossier_trust_compute (nguồn sự thật duy nhất — không tính lại ở đâu khác).
-- Id không đọc được bị BỎ QUA lặng lẽ (không ném lỗi) để một hồ sơ mất quyền không làm
-- hỏng cả danh sách.

CREATE FUNCTION public.asset_postings_dossier_levels(p_posting_ids UUID[])
RETURNS TABLE (posting_id UUID, score INT, level TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c_max_ids CONSTANT INT := 500;
  v_admin   BOOLEAN := public.admin_has_permission('tai-san-tu-nguyen', 'view');
  v_id      UUID;
  v_trust   jsonb;
BEGIN
  IF cardinality(p_posting_ids) > c_max_ids THEN
    RAISE EXCEPTION 'Tối đa % hồ sơ mỗi lần', c_max_ids USING ERRCODE = '22023';
  END IF;
  FOR v_id IN SELECT DISTINCT unnest(p_posting_ids) LOOP
    CONTINUE WHEN NOT (v_admin OR public.owner_posting_can(v_id, 'read'));
    v_trust := public._dossier_trust_compute(v_id);
    CONTINUE WHEN v_trust IS NULL;
    posting_id := v_id;
    score := (v_trust ->> 'score')::int;
    level := v_trust ->> 'level';
    RETURN NEXT;
  END LOOP;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.asset_postings_dossier_levels(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.asset_postings_dossier_levels(UUID[]) TO authenticated;
