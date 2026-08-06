-- Giấy tờ hành nghề BẮT BUỘC có bản chụp đính kèm.
--
-- Phụ lục trang 3 của mẫu xuất PDF "Năng lực" dựng từ chính các ảnh này, nên
-- giấy tờ không ảnh làm hồ sơ xuất ra khuyết một trang.
--
-- NOT VALID: ràng buộc có hiệu lực NGAY với mọi INSERT/UPDATE từ giờ, nhưng
-- không quét 35 dòng demo đang trống — chúng được nạp ảnh bằng
-- scripts/seed-personnel-images.js (phải chạy trong trình duyệt vì Storage API
-- cần phiên đăng nhập). Nạp xong thì chạy VALIDATE ở migration kế tiếp.
ALTER TABLE public.org_auctioneer_documents
  DROP CONSTRAINT IF EXISTS org_auctioneer_documents_scan_required;

ALTER TABLE public.org_auctioneer_documents
  ADD CONSTRAINT org_auctioneer_documents_scan_required
  CHECK (array_length(file_paths, 1) >= 1) NOT VALID;
