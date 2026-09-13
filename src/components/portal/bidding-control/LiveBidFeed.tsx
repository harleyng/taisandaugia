import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatVnd } from "@/lib/advertising/slug";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { useLotBids } from "@/hooks/useLotBids";
import type { AuctionSessionItem } from "@/types/auction-session";

/**
 * Diễn biến trả giá của lô đang chọn — bản của TỔ CHỨC.
 *
 * Khác BidHistory ở phòng người mua đúng một điều, nhưng là điều quyết định:
 * ở đây hiện HỌ TÊN người trả giá, vì tổ chức đọc được auction_bidding_contracts.
 * Người mua chỉ thấy số báo danh.
 *
 * Không có realtime riêng: kênh trong useLotStates (do BiddingControlRoom mount)
 * đánh thức query này.
 */

interface Props {
  sessionId: string;
  lot: AuctionSessionItem;
  leadingBidId: string | null;
  /** số báo danh → họ tên, dựng từ hồ sơ tham gia của phiên. */
  nameByBidderNo: Map<number, string>;
}

export function LiveBidFeed({ sessionId, lot, leadingBidId, nameByBidderNo }: Props) {
  const { data: bids, isLoading } = useLotBids(sessionId, lot.id);

  return (
    <Card className="rounded-2xl p-5">
      <div className="mb-3">
        <h2 className="font-semibold text-foreground">Diễn biến trả giá — lô {lot.lot_no}</h2>
        <p className="text-xs text-muted-foreground truncate">{lot.title}</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : !bids?.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Chưa có lượt trả giá nào cho lô này.
        </p>
      ) : (
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {bids.map((bid) => {
            const withdrawn = bid.withdrawn_at != null;
            const leading = bid.id === leadingBidId && !withdrawn;
            const name = nameByBidderNo.get(bid.bidder_no);

            return (
              <li
                key={bid.id}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3",
                  leading ? "border-primary/30 bg-primary/5" : "border-border",
                  withdrawn && "opacity-60",
                )}
              >
                <div className="min-w-0">
                  <p className={cn("font-semibold tabular-nums text-foreground", withdrawn && "line-through")}>
                    {formatVnd(bid.amount)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    SBD {formatBidderNo(bid.bidder_no)}
                    {name ? ` · ${name}` : ""}
                    {" · "}
                    {new Date(bid.placed_at).toLocaleTimeString("vi-VN")}
                    {withdrawn && <span className="ml-1 font-medium text-destructive">· Đã rút</span>}
                  </p>
                </div>
                {leading && <span className="text-xs font-semibold text-primary">Đang dẫn đầu</span>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
