-- org_branch_marker bỏ sót mẫu "Công ty Quản lý tài sản <Ngân hàng X>" — dạng
-- AMC phổ biến nhất. Backfill owner_kind (20260805000001) đã coi "quan ly tai san"
-- là AMC, nên hai heuristic đang lệch nhau: bản ghi được gắn owner_kind='amc'
-- nhưng lại không đủ điều kiện làm đơn vị thành viên khi suy ra quan hệ mẹ–con.

CREATE OR REPLACE FUNCTION public.org_branch_marker(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN public.normalize_org_name(p_name) ~ '(amc|quan ly no|khai thac tai san|quan ly tai san)' THEN 'amc'
    WHEN public.normalize_org_name(p_name) ~ '(chi nhanh|phong giao dich|so giao dich)'           THEN 'branch'
    ELSE NULL
  END;
$$;

SELECT public.infer_org_parents();
