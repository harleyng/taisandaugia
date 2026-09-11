-- ─────────────────────────────────────────────────────────────────────────────
-- Mở rộng taxonomy tài sản: 2 nhóm cha mới + 26 loại con.
--
--   Thủ công mỹ nghệ (thu-cong-my-nghe) — 15 loại con
--   Cổ vật & sưu tầm (co-vat-suu-tam)   — 11 loại con
--
-- Chỉ sửa public.asset_parent_slug(). KHÔNG có thay đổi schema: listings.
-- property_type_slug và asset_postings.parent_slug/child_slug đều là TEXT tự do,
-- không CHECK constraint, nên slug mới ghi được ngay mà không cần migration.
--
-- ĐỒNG BỘ BẮT BUỘC với PARENT_OF / PARENT_SLUGS / PARENT_LABELS trong
-- src/lib/reports/listingsReport.ts. Thiếu bước này thì 26 slug mới rơi hết vào
-- nhóm 'khac' trên biểu đồ báo cáo "Tin đấu giá" trong khi bộ lọc bảng chi tiết
-- (chạy ở client) lại gom đúng nhóm — hai bên lệch nhau mà không báo lỗi.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.asset_parent_slug(_slug TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    -- slug cha tự nó
    WHEN _slug IN ('bat-dong-san','xe-co','may-moc','hang-hoa','do-dung',
                   'thu-cong-my-nghe','co-vat-suu-tam','khac')
      THEN _slug
    -- Bất động sản (thế hệ mới)
    WHEN _slug IN ('dat-o','dat-nong-nghiep','nha-pho','can-ho','nha-xuong','shophouse')
      THEN 'bat-dong-san'
    -- Bất động sản (thế hệ cũ, property_types)
    WHEN _slug IN ('can-ho-chung-cu','chung-cu-mini-chdv','nha-rieng','biet-thu',
                   'nha-biet-thu','nha-lien-ke','nha-mat-pho','dat-nen-du-an',
                   'dat-nen','dat-tho-cu','trang-trai-khu-nghi-duong',
                   'kho-nha-xuong','kho-xuong','condotel','cua-hang-kiot',
                   'nha-tro-phong-tro','van-phong',
                   'cac-loai-nha','cac-loai-dat','bds-khac')
      THEN 'bat-dong-san'
    WHEN _slug IN ('o-to','xe-tai','xe-may')                         THEN 'xe-co'
    WHEN _slug IN ('may-cong-trinh','may-nong-nghiep','day-chuyen')  THEN 'may-moc'
    WHEN _slug IN ('gach-vat-lieu','sat-thep','hang-ton-kho')        THEN 'hang-hoa'
    WHEN _slug IN ('noi-that','thiet-bi','cong-cu')                  THEN 'do-dung'
    -- Thủ công mỹ nghệ
    WHEN _slug IN ('gom-su','tranh','tuong','cham-khac','son-mai','do-go','lua',
                   'theu','tho-cam','may-tre','coi-luc-binh','do-dong','kim-hoan',
                   'da-my-nghe','giay-do')
      THEN 'thu-cong-my-nghe'
    -- Cổ vật & sưu tầm. Lưu ý các cặp slug gần giống bên thủ công mỹ nghệ:
    -- gom-su/gom-su-co, do-dong/do-dong-co, tranh/tranh-xua, tuong/tuong-tho.
    WHEN _slug IN ('gom-su-co','do-dong-co','do-go-xua','tuong-tho','tranh-xua',
                   'tien-co','tem','sach-tu-lieu','trang-suc','da-quy','dong-ho')
      THEN 'co-vat-suu-tam'
    ELSE 'khac'
  END;
$$;
