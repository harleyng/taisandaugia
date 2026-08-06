-- Đuôi dài của AuctionRecord (hình thức đấu giá, bước giá, số vòng, tỷ lệ đặt
-- trước, kết quả từng tài sản, xuất xứ trường, nhật ký ghi đè…) gom vào một cột
-- JSONB thay vì ~15 cột rời.
--
-- Lý do: các trường đó chỉ để hiển thị/round-trip, không có truy vấn nào lọc
-- hay tổng hợp theo chúng. Cột rời chỉ làm bảng phình và mọi câu SELECT của
-- RPC thống kê phải kéo thêm dữ liệu vô ích.
ALTER TABLE public.org_auction_records
  ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.org_auction_records.details IS
  'Trường phụ của AuctionRecord: auctionFormat, biddingMethod, bidStep, maxRounds, actualRounds, depositPercentage, assetResults, legalStatus, importedAt, importBatchId…';
