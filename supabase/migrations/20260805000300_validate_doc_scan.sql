-- Siết ràng buộc "giấy tờ phải có bản chụp" thành ĐẦY ĐỦ.
--
-- Migration 20260805000220 thêm CHECK ở dạng NOT VALID để không khoá 35 dòng
-- demo đang trống. Ảnh cho chúng đã được nạp xong, nên giờ quét nốt dữ liệu cũ.
-- VALIDATE sẽ FAIL nếu còn dòng thiếu ảnh — đó là chủ đích: thà dừng còn hơn
-- để ràng buộc nửa vời.
ALTER TABLE public.org_auctioneer_documents
  VALIDATE CONSTRAINT org_auctioneer_documents_scan_required;
