import type { KeyboardEvent, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoneyShort } from "@/utils/money";
import type { OwnerAssetRow } from "@/lib/ownerAssets";
import { AssetIdTag } from "@/components/asset-owner-portal/outcomes/AssetIdTag";
import { PostingThumb } from "@/components/asset-posting/digitize/PostingThumb";
import { StageTrack } from "./StageTrack";

/** Hai dòng: giá trị chính + dòng phụ mờ — mọi ô dùng chung một kiểu để đọc đồng nhất. */
export function Stacked({ main, sub, className }: { main: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <span className="block whitespace-nowrap text-[13.5px] font-semibold">{main}</span>
      {sub && <small className="block whitespace-nowrap text-[12.5px] text-muted-foreground">{sub}</small>}
    </div>
  );
}

export const TH = "whitespace-nowrap border-b border-border bg-muted/40 px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground first:pl-5 last:pr-5";
export const TD = "px-3 py-3 align-middle first:pl-5 last:pr-5";

function PriceCell({ row }: { row: OwnerAssetRow }) {
  if (row.priceKind === "winning" && row.price !== null) {
    const pct = row.startingPrice ? Math.round((row.price / row.startingPrice - 1) * 100) : null;
    return (
      <Stacked
        main={formatMoneyShort(row.price)}
        sub={
          <>
            KĐ {formatMoneyShort(row.startingPrice)}
            {pct !== null && pct > 0 && <span className="font-semibold text-primary"> · +{pct}%</span>}
          </>
        }
      />
    );
  }
  return <Stacked main={formatMoneyShort(row.price)} sub={row.price === null ? "Chưa định giá" : "Khởi điểm"} />;
}

interface AssetRowsTableProps {
  rows: OwnerAssetRow[];
  onOpen: (row: OwnerAssetRow) => void;
  onCta: (row: OwnerAssetRow) => void;
}

export function AssetRowsTable({ rows, onOpen, onCta }: AssetRowsTableProps) {
  const onKey = (e: KeyboardEvent, row: OwnerAssetRow) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(row);
    }
  };

  return (
    <table className="w-full border-collapse text-[13.5px]">
      <thead>
        <tr>
          <th className={TH}>Tài sản</th>
          <th className={TH}>Khu vực</th>
          <th className={TH}>Giai đoạn</th>
          <th className={cn(TH, "text-right")}>Vòng</th>
          <th className={cn(TH, "hidden text-right md:table-cell")}>Giá</th>
          <th className={TH}>
            <span className="sr-only">Hành động</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          return (
            <tr
              key={`${row.kind}:${row.id}`}
              tabIndex={0}
              onClick={() => onOpen(row)}
              onKeyDown={(e) => onKey(e, row)}
              className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            >
              <td className={TD}>
                <div className="flex items-center gap-3">
                  <PostingThumb src={row.thumbnail} parentSlug={row.parentSlug} className="h-11 w-14 rounded-[7px]" />
                  <div className="min-w-0">
                    <span className="block max-w-[320px] truncate text-sm font-medium">{row.title}</span>
                    <small className="flex items-baseline gap-1.5 whitespace-nowrap text-[12.5px] text-muted-foreground">
                      {row.code && (
                        <>
                          <AssetIdTag listingId={row.id} />·
                        </>
                      )}
                      <span>{row.category ?? (row.kind === "posting" ? "Hồ sơ số hoá" : "Tin trên sàn")}</span>
                    </small>
                  </div>
                </div>
              </td>
              <td className={TD}>
                <Stacked main={row.province ?? "—"} sub={row.branch} />
              </td>
              <td className={TD}>
                <StageTrack phase={row.phase} />
                <span className={cn("whitespace-nowrap text-[13.5px] font-semibold", row.overdue && "text-destructive")}>
                  {row.stepLabel}
                  {row.overdue && <span className="sr-only">, chậm tiến độ</span>}
                </span>
              </td>
              <td className={cn(TD, "whitespace-nowrap text-right tabular-nums")}>
                {row.rounds > 0 ? <b className="font-bold">Vòng {row.rounds}</b> : <span className="text-muted-foreground">—</span>}
              </td>
              <td className={cn(TD, "hidden text-right tabular-nums md:table-cell")}>
                <PriceCell row={row} />
              </td>
              <td className={cn(TD, "w-[1%] whitespace-nowrap text-right")}>
                {row.next.cta && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-[30px] px-3 text-[12.5px] font-semibold"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCta(row);
                    }}
                  >
                    {row.next.cta.label}
                  </Button>
                )}
                <ChevronRight className="ml-2 hidden h-4 w-4 align-middle text-muted-foreground/70 md:inline" aria-hidden="true" />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
