-- Asset postings: thêm trạng thái 'active' (đã số hoá)
--
-- Bối cảnh: chủ tài sản có thể số hoá hồ sơ tài sản MÀ KHÔNG cần chọn tổ chức đấu giá.
-- Việc chọn & gửi yêu cầu tới tổ chức đấu giá (asset_service_requests) là 1 LUỒNG RIÊNG,
-- tách khỏi số hoá. Vòng đời:
--   draft   → lưu nháp giữa chừng ("Lưu và thoát")
--   active  → đã số hoá xong (KHÔNG bắt buộc có tổ chức)
--   matched/contracted/cancelled → giữ nguyên cho tương lai
-- Quan hệ với tổ chức nằm ở bảng asset_service_requests, không đổi status posting.

ALTER TABLE public.asset_postings
  DROP CONSTRAINT IF EXISTS asset_postings_status_check;

ALTER TABLE public.asset_postings
  ADD CONSTRAINT asset_postings_status_check
  CHECK (status IN ('draft', 'active', 'pending', 'matched', 'contracted', 'cancelled'));
