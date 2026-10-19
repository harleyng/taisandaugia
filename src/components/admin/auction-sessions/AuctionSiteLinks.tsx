import { ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AuctionLink } from "@/components/shared/AuctionLink";
import { AUCTION_LINKS } from "@/lib/auctionPlatform";
import { cn } from "@/lib/utils";

/**
 * Link sâu từ admin sang sàn đấu giá (Phase 6.1) — mở tab mới, admin không rời màn
 * giám sát. Chỉ trang công khai: cổng điều hành của tổ chức cần là thành viên tổ chức.
 */
export function AuctionSiteLinks({ sessionId, live }: { sessionId: string; live: boolean }) {
  const cls = cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5");
  return (
    <div className="flex flex-wrap gap-2">
      <AuctionLink to={AUCTION_LINKS.session(sessionId)} target="_blank" rel="noopener noreferrer" className={cls}>
        Trang phiên trên sàn
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </AuctionLink>
      <AuctionLink
        to={AUCTION_LINKS.sessionRoom(sessionId)}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(cls, live && "border-primary text-primary")}
      >
        Phòng đấu giá
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </AuctionLink>
      <AuctionLink to={AUCTION_LINKS.sessionQa(sessionId)} target="_blank" rel="noopener noreferrer" className={cls}>
        Hỏi đáp
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </AuctionLink>
    </div>
  );
}
