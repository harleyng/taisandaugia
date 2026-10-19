import { Gavel } from "lucide-react";
import { AuctionPlatformCard } from "@/components/shared/AuctionPlatformCard";
import { AUCTION_LINKS } from "@/lib/auctionPlatform";

/**
 * Tab "Phiên đấu giá" của trang tổ chức. Phiên đấu giá trực tuyến chạy ở Sàn đấu
 * giá trực tuyến (Phase 5) ⇒ tab chỉ còn là lối sang sàn, không đọc bảng phiên.
 */
export function CompanySessionsTab() {
  return (
    <AuctionPlatformCard
      icon={Gavel}
      title="Phiên đấu giá trực tuyến"
      description="Các phiên do tổ chức công bố — đăng ký hồ sơ, nộp tiền đặt trước và trả giá — nằm trên Sàn đấu giá trực tuyến."
      cta="Xem các phiên trên sàn đấu giá"
      to={AUCTION_LINKS.sessions}
    />
  );
}
