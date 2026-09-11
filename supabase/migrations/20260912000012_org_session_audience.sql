-- ─────────────────────────────────────────────────────────────────────────────
-- Truy vấn CHỌN NGƯỜI NHẬN khi tiếp thị một phiên đấu giá.
--
-- "Selection is a query, not a judgement": đây là NGUỒN DUY NHẤT của luật khớp —
-- không có bản sao TypeScript, không chấm điểm, không xếp hạng theo cảm tính.
-- Client chỉ hiển thị `reasons` mà hàm trả về.
--
-- LUẬT (mỗi dòng nhu cầu × mỗi lô; các chiều AND trong một dòng; khách khớp lô
-- nếu BẤT KỲ dòng nhu cầu nào khớp):
--   loại tài sản : categories rỗng
--                  HOẶC (lô CÓ category_slug VÀ (slug ∈ categories
--                        HOẶC asset_parent_slug(slug) ∈ categories))
--                  — bắt buộc kiểm NOT NULL: asset_parent_slug(NULL) trả 'khac'.
--   tỉnh/thành   : province_keys rỗng
--                  HOẶC (lô CÓ tỉnh VÀ normalize_province(lô) ∈ province_keys)
--   giá          : không có cận nào
--                  HOẶC (lô CÓ giá khởi điểm VÀ nằm trong [price_min, price_max], hai đầu tính cả)
--
-- ĐỦ ĐIỀU KIỆN GỬI (eligible) = status 'active' VÀ notifications_enabled.
-- Khách khớp nhưng không đủ điều kiện VẪN được trả về (eligible=false) để tổ chức
-- thấy vì sao danh sách gửi nhỏ hơn danh sách khớp — UI gom họ vào mục riêng.
--
-- PHÂN KHÚC (segment_key): 'lot:<item_uuid>' nếu khớp đúng MỘT lô, 'multi' nếu
-- khớp từ hai lô. Theo UUID chứ không theo lot_no vì trigger đánh lại số lô khi
-- gỡ lô (20260911000003). Tối đa N+1 câu chào cho N lô.
--
-- QUYỀN: cần CẢ phien-dau-gia.view (thấy phiên) VÀ khach-hang.view (thấy danh bạ)
-- trên tổ chức sở hữu phiên. SECURITY DEFINER để đọc lô + danh bạ trong một câu,
-- nên kiểm quyền ở đầu hàm là ranh giới thật.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.org_session_audience(_session_id UUID, _group_ids UUID[] DEFAULT NULL)
RETURNS TABLE (
  contact_id            UUID,
  code                  TEXT,
  full_name             TEXT,
  contact_type          TEXT,
  company_name          TEXT,
  phone                 TEXT,
  email                 TEXT,
  zalo                  TEXT,
  province              TEXT,
  notifications_enabled BOOLEAN,
  status                TEXT,
  eligible              BOOLEAN,
  group_ids             UUID[],
  matched_item_ids      UUID[],
  matched_lot_nos       INT[],
  reasons               JSONB,
  segment_key           TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  _org UUID;
BEGIN
  SELECT s.organization_id INTO _org FROM public.auction_sessions s WHERE s.id = _session_id;

  IF _org IS NULL
     OR NOT public.can_manage_auction_sessions(_org, 'view')
     OR NOT public.can_manage_org_contacts(_org, 'view') THEN
    RAISE EXCEPTION 'Không có quyền xem danh sách người nhận của phiên này.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH lots AS (
    SELECT i.id            AS item_id,
           i.lot_no        AS lot_no,
           i.category_slug AS category_slug,
           CASE WHEN i.category_slug IS NULL THEN NULL
                ELSE public.asset_parent_slug(i.category_slug) END AS parent_slug,
           public.normalize_province(i.province) AS prov,
           i.starting_price AS starting_price
      FROM public.auction_session_items i
     WHERE i.session_id = _session_id
  ),
  hits AS (
    SELECT ci.contact_id AS hit_contact,
           ci.id         AS interest_id,
           l.item_id     AS item_id,
           l.lot_no      AS lot_no,
           array_remove(ARRAY[
             CASE WHEN cardinality(ci.categories) > 0 THEN 'category' END,
             CASE WHEN cardinality(ci.province_keys) > 0 THEN 'province' END,
             CASE WHEN ci.price_min IS NOT NULL OR ci.price_max IS NOT NULL THEN 'price' END
           ], NULL) AS dims
      FROM public.org_contact_interests ci
      JOIN lots l
        ON (cardinality(ci.categories) = 0
            OR (l.category_slug IS NOT NULL
                AND (l.category_slug = ANY (ci.categories) OR l.parent_slug = ANY (ci.categories))))
       AND (cardinality(ci.province_keys) = 0
            OR (l.prov IS NOT NULL AND l.prov = ANY (ci.province_keys)))
       AND (ci.price_min IS NULL
            OR (l.starting_price IS NOT NULL AND l.starting_price >= ci.price_min))
       AND (ci.price_max IS NULL
            OR (l.starting_price IS NOT NULL AND l.starting_price <= ci.price_max))
     WHERE ci.organization_id = _org
  ),
  contact_lots AS (
    SELECT DISTINCT h.hit_contact, h.item_id, h.lot_no FROM hits h
  ),
  per_contact AS (
    SELECT cl.hit_contact,
           array_agg(cl.item_id ORDER BY cl.lot_no) AS item_ids,
           array_agg(cl.lot_no  ORDER BY cl.lot_no) AS lot_nos
      FROM contact_lots cl
     GROUP BY cl.hit_contact
  ),
  per_reasons AS (
    SELECT h.hit_contact,
           jsonb_agg(jsonb_build_object(
             'interest_id', h.interest_id,
             'item_id',     h.item_id,
             'lot_no',      h.lot_no,
             'dims',        to_jsonb(h.dims)
           ) ORDER BY h.lot_no, h.interest_id) AS reasons
      FROM hits h
     GROUP BY h.hit_contact
  ),
  memberships AS (
    SELECT m.contact_id AS member_contact, array_agg(m.group_id ORDER BY m.group_id) AS gids
      FROM public.org_contact_group_members m
     WHERE m.organization_id = _org
     GROUP BY m.contact_id
  )
  SELECT c.id,
         c.code,
         c.full_name,
         c.contact_type,
         c.company_name,
         c.phone,
         c.email,
         c.zalo,
         c.province,
         c.notifications_enabled,
         c.status,
         (c.status = 'active' AND c.notifications_enabled),
         COALESCE(mb.gids, '{}'::UUID[]),
         pc.item_ids,
         pc.lot_nos,
         pr.reasons,
         CASE WHEN cardinality(pc.item_ids) = 1 THEN 'lot:' || pc.item_ids[1]::TEXT ELSE 'multi' END
    FROM per_contact pc
    JOIN per_reasons pr ON pr.hit_contact = pc.hit_contact
    JOIN public.org_contacts c ON c.id = pc.hit_contact AND c.organization_id = _org
    LEFT JOIN memberships mb ON mb.member_contact = c.id
   WHERE _group_ids IS NULL
      OR cardinality(_group_ids) = 0
      OR COALESCE(mb.gids, '{}'::UUID[]) && _group_ids
   ORDER BY (c.status = 'active' AND c.notifications_enabled) DESC,
            cardinality(pc.item_ids) DESC,
            lower(c.full_name),
            c.code;
END; $$;

REVOKE ALL ON FUNCTION public.org_session_audience(UUID, UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.org_session_audience(UUID, UUID[]) TO authenticated;

COMMENT ON FUNCTION public.org_session_audience(UUID, UUID[]) IS
  'Người nhận tiếp thị của một phiên: khách của tổ chức có nhu cầu khớp ít nhất một lô (loại tài sản / tỉnh / giá). Nguồn duy nhất của luật khớp.';
