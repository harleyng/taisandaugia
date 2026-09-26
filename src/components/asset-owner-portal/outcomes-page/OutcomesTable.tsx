import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AssetIdTag } from "@/components/asset-owner-portal/outcomes/AssetIdTag";
import { OutcomeResultCell } from "@/components/asset-owner-portal/outcomes/OutcomeResultCell";
import type { OutcomeOverviewRow } from "@/lib/ownerOutcomesOverview";
import type { ResolvedAssetOutcome } from "@/lib/ownerOutcomes";

const PAGE = 50;

const GRID =
  "md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_6.5rem_minmax(0,1.6fr)_3.5rem] md:items-center md:gap-4";

const formatDay = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

/** Dòng tổng quan ⇒ đúng hình dạng ô "Kết quả" dùng chung với bảng tài sản. */
const asResolved = (r: OutcomeOverviewRow): ResolvedAssetOutcome => ({
  listingId: r.listingId ?? r.rowKey,
  outcome: r.outcome,
  price: r.price,
  date: r.date,
  paymentStatus: r.paymentStatus,
  confidence: r.confidence,
  hasConflict: r.hasConflict,
  sources: r.sources,
});

interface OutcomesTableProps {
  rows: OutcomeOverviewRow[];
  branchNames: ReadonlyMap<string, string>;
  onOpen: (row: OutcomeOverviewRow) => void;
}

/** L4: mỗi tài sản một dòng; dưới md thu thành các dòng xếp chồng. Bấm dòng ⇒ nguồn + lịch sử lượt. */
export function OutcomesTable({ rows, branchNames, onOpen }: OutcomesTableProps) {
  const [limit, setLimit] = useState(PAGE);
  const shown = rows.slice(0, limit);

  return (
    <div className="text-sm">
      <div className={cn("hidden border-b pb-2 text-xs text-muted-foreground", GRID)}>
        <span>Tài sản</span>
        <span>Chi nhánh</span>
        <span>Ngày đấu</span>
        <span>Kết quả</span>
        <span className="text-right">Lượt</span>
      </div>

      <ul className="divide-y">
        {shown.map((r) => (
          // Tên tài sản là nút chính, phủ cả dòng (after:inset-0); nhãn nguồn nằm
          // trên lớp phủ để tooltip của nó vẫn bấm được — không lồng button trong button.
          <li
            key={r.rowKey}
            className={cn(
              "relative flex flex-wrap items-start gap-x-3 gap-y-1.5 py-3 transition-colors hover:bg-muted/40",
              GRID,
            )}
          >
            <div className="min-w-0 basis-full md:basis-auto">
              <button
                type="button"
                onClick={() => onOpen(r)}
                className="line-clamp-2 text-left font-medium text-foreground after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                {r.title}
              </button>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                {r.listingId ? (
                  <AssetIdTag listingId={r.listingId} />
                ) : (
                  <Badge variant="outline" className="px-1.5 py-0 text-[11px] font-normal text-muted-foreground">
                    Ngoài sàn
                  </Badge>
                )}
                {r.orgName && <span className="truncate text-xs text-muted-foreground">{r.orgName}</span>}
              </div>
            </div>

            <p className="min-w-0 truncate text-muted-foreground">
              {r.branchId ? branchNames.get(r.branchId) ?? "—" : "Toàn đơn vị"}
            </p>

            <p className="tabular-nums text-muted-foreground">{formatDay(r.date)}</p>

            <div className="relative z-10 min-w-0 basis-full md:basis-auto">
              <OutcomeResultCell outcome={asResolved(r)} />
            </div>

            <p className="hidden text-right tabular-nums text-muted-foreground md:block">
              {r.ownRoundNo ?? (r.roundsReported ? r.roundsReported : "—")}
            </p>
          </li>
        ))}
      </ul>

      {rows.length > limit && (
        <div className="pt-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
            Xem thêm {Math.min(PAGE, rows.length - limit)} tài sản
          </Button>
        </div>
      )}
    </div>
  );
}
