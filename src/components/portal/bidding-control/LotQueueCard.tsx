import { BidderNoChip, DetailCard } from "@/components/portal/auction-sessions/DetailCard";
import { cn } from "@/lib/utils";
import { formatMoneyShort } from "@/utils/money";
import type { LotViewKey } from "@/lib/bidding/controlView";
import type { LotState } from "@/types/auction-bidding";
import type { AuctionSessionItem } from "@/types/auction-session";

/**
 * "Thứ tự lô" ở cột phải (design `.ox-q`): ô số lô đổi màu theo trạng thái, lô
 * đang đấu tô nền xanh dương (tạm dừng: vàng), lô đã trúng hiện giá trúng + số báo danh.
 */

const ROW: Partial<Record<LotViewKey, string>> = {
  live: "bg-[hsl(var(--tier-info-bg))]",
  paused: "bg-[hsl(var(--tier-warn-bg))]",
};
const NO: Partial<Record<LotViewKey, string>> = {
  live: "bg-[hsl(var(--tier-info))] text-white",
  paused: "bg-warning text-white",
  won: "bg-primary/10 text-primary",
};
const DONE = new Set<LotViewKey>(["won", "unsold", "pulled", "closed"]);

interface Props {
  lots: { lot: AuctionSessionItem; state: LotState | null; key: LotViewKey }[];
  done: number;
}

export function LotQueueCard({ lots, done }: Props) {
  return (
    <DetailCard title="Thứ tự tài sản" aside={<span className="tabular-nums">{done}/{lots.length} đã đóng</span>}>
      <ol className="m-0 list-none px-3 pb-2.5 pt-1.5">
        {lots.map(({ lot, state, key }) => (
          <li
            key={lot.id}
            className={cn("grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[10px] p-2.5 [&+li]:mt-0.5", ROW[key])}
          >
            <span
              className={cn(
                "grid h-7 w-7 place-items-center rounded-lg bg-muted text-[12.5px] font-bold tabular-nums text-muted-foreground",
                NO[key],
              )}
            >
              {lot.lot_no}
            </span>
            <span className="min-w-0">
              <b
                className={cn(
                  "block truncate text-[13px]",
                  DONE.has(key) ? "font-medium text-muted-foreground" : "font-semibold text-foreground",
                )}
              >
                {lot.title}
              </b>
              <small className="text-xs tabular-nums text-muted-foreground">
                Khởi điểm {lot.starting_price != null ? formatMoneyShort(lot.starting_price) : "—"}
              </small>
            </span>
            {key === "won" && state?.winning_amount != null ? (
              <span className="text-right text-[13px] tabular-nums">
                <b className="font-semibold">{formatMoneyShort(state.winning_amount)}</b>
                <small className="mt-0.5 block [&>span]:min-w-0 [&>span]:px-[5px] [&>span]:py-px [&>span]:text-[11.5px]">
                  <BidderNoChip no={state.leading_bidder_no} />
                </small>
              </span>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ol>
    </DetailCard>
  );
}
