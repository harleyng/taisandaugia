-- ─────────────────────────────────────────────────────────────────────────────
-- Bổ sung trường theo docs/ho-so-nhan-su-dgv-spec.md (mục 5 — backlog)
--
-- Ba trường mở khoá điểm TT19/2024/TT-BTP đang bị mất oan:
--   1. practice_start_date    → IV.7 & IV.8. Thẻ ĐGV chỉ tồn tại từ 1/7/2017;
--      ai hành nghề trước đó theo NĐ 17/2010 mà tính từ ngày cấp thẻ thì hụt
--      tới ~7 năm, rớt ngưỡng ≥5 năm / ≥10 năm.
--   2. management_start_date  → IV.7 (thâm niên Giám đốc) và tie-break V.2.
--   3. is_state_auction_center trên quá trình công tác → V.2, tối đa 4đ.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.org_auctioneers
  -- Mốc bắt đầu hành nghề đấu giá: ngày cấp Thẻ ĐGV, HOẶC ngày đăng ký danh
  -- sách tại Sở Tư pháp theo NĐ 05/2005 / NĐ 17/2010 — lấy mốc SỚM NHẤT.
  ADD COLUMN IF NOT EXISTS practice_start_date   DATE,
  -- Ngày bắt đầu giữ chức quản lý (Giám đốc / Phó Giám đốc).
  ADD COLUMN IF NOT EXISTS management_start_date DATE;

COMMENT ON COLUMN public.org_auctioneers.practice_start_date IS
  'Mốc bắt đầu hành nghề đấu giá (sớm nhất). Rỗng thì suy ra từ license_issued_date.';

ALTER TABLE public.org_auctioneer_events
  -- Cờ "Trung tâm dịch vụ đấu giá tài sản (Sở Tư pháp)". Trước đây nơi công
  -- tác là text tự do nên không đếm được để chấm V.2.
  ADD COLUMN IF NOT EXISTS is_state_auction_center BOOLEAN NOT NULL DEFAULT false;

-- ─── RPC công khai: dùng mốc hành nghề sớm nhất ─────────────────────────────
-- Trang công khai phải khớp con số trong hồ sơ xuất ra, nếu không cùng một
-- người sẽ hiện hai số năm kinh nghiệm khác nhau ở hai chỗ.
CREATE OR REPLACE FUNCTION public.public_org_auctioneers(_auction_org_id UUID)
RETURNS TABLE (
  id                  UUID,
  full_name           TEXT,
  title               TEXT,
  license_number      TEXT,
  license_issued_date DATE,
  years_of_experience INT,
  portrait_url        TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    a.id,
    a.full_name,
    COALESCE(
      NULLIF(a.public_title, ''),
      CASE a.position
        WHEN 'DIRECTOR'        THEN 'Giám đốc'
        WHEN 'DEPUTY_DIRECTOR' THEN 'Phó Giám đốc'
        ELSE 'Đấu giá viên'
      END
    ) AS title,
    a.license_number,
    a.license_issued_date,
    GREATEST(0, EXTRACT(YEAR FROM age(
      now(),
      LEAST(COALESCE(a.practice_start_date, a.license_issued_date), a.license_issued_date)
    ))::int) AS years_of_experience,
    a.portrait_url
  FROM public.org_auctioneers a
  WHERE a.auction_org_id = _auction_org_id
    AND a.is_public_profile
    AND a.is_active
  ORDER BY
    CASE a.position WHEN 'DIRECTOR' THEN 0 WHEN 'DEPUTY_DIRECTOR' THEN 1 ELSE 2 END,
    a.license_issued_date;
$$;

GRANT EXECUTE ON FUNCTION public.public_org_auctioneers(UUID) TO anon, authenticated;
