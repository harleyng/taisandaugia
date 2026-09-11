import { AlertTriangle } from "lucide-react";
import { formatVnd } from "@/lib/advertising/slug";
import { categoryLabel } from "@/lib/orgContacts/interestLabel";
import type { AuctionSessionItem } from "@/types/auction-session";
import type { AudienceRow } from "@/types/org-contacts";

interface Props {
  lots: AuctionSessionItem[];
  rows: AudienceRow[];
}

/** Mỗi lô có bao nhiêu khách đủ điều kiện gửi — lô 0 khách là lô cần tìm thêm người mua. */
export function AudienceLotCoverage({ lots, rows }: Props) {
  const eligibleByLot = new Map<string, number>();
  for (const r of rows) {
    if (!r.eligible) continue;
    for (const id of r.matched_item_ids) eligibleByLot.set(id, (eligibleByLot.get(id) ?? 0) + 1);
  }

  return (
    <ul className="divide-y rounded-xl border text-sm">
      {lots.map((lot) => {
        const n = eligibleByLot.get(lot.id) ?? 0;
        return (
          <li key={lot.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <span className="font-medium text-foreground">Lô {lot.lot_no}</span>
              <span className="text-muted-foreground"> · {lot.title}</span>
              <p className="text-xs text-muted-foreground">
                {[
                  lot.category_slug ? categoryLabel(lot.category_slug) : "Chưa phân loại",
                  lot.province ?? "Chưa rõ tỉnh",
                  lot.starting_price != null ? formatVnd(lot.starting_price) : "Chưa có giá khởi điểm",
                ].join(" · ")}
              </p>
            </div>
            {n > 0 ? (
              <span className="whitespace-nowrap font-medium text-success">{n} khách đủ điều kiện</span>
            ) : (
              <span className="flex items-center gap-1 whitespace-nowrap text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                Chưa có khách phù hợp
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
