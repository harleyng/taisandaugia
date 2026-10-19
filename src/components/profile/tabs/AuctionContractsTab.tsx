import { FileSignature } from "lucide-react";
import { AuctionPlatformCard } from "@/components/shared/AuctionPlatformCard";
import { AUCTION_LINKS } from "@/lib/auctionPlatform";

/**
 * "Hồ sơ đấu giá" trong trang hồ sơ cá nhân (/profile?tab=auction-contracts). Danh
 * sách hồ sơ tham gia, điểm danh và tiền đặt trước đã chuyển sang Sàn đấu giá trực
 * tuyến (Phase 5) — tab giữ lại để link / thói quen cũ vẫn tới đúng chỗ.
 */
export const AuctionContractsTab = () => (
  <div className="flex min-w-0 flex-col">
    <div className="mb-5">
      <h1 className="text-2xl font-bold tracking-[-0.015em] text-foreground">Hồ sơ đấu giá</h1>
      <p className="mt-0.5 text-sm text-muted-foreground">Hồ sơ tham gia các phiên đấu giá bạn đã mua.</p>
    </div>
    <AuctionPlatformCard
      icon={FileSignature}
      title="Hồ sơ đấu giá ở Sàn đấu giá trực tuyến"
      description="Mua hồ sơ, nộp tiền đặt trước, điểm danh và trả giá nay thực hiện trên Sàn đấu giá trực tuyến — đăng nhập bằng chính tài khoản Tài Sản Đấu Giá."
      cta="Mở hồ sơ đấu giá"
      to={AUCTION_LINKS.myContracts}
    />
  </div>
);
