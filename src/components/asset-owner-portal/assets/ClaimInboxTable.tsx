import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoneyShort } from "@/utils/money";
import { formatDayMonth } from "@/lib/ownerPulse";
import type { OwnerClaimRow } from "@/lib/ownerAssets";
import { Stacked, TD, TH } from "./AssetRowsTable";

interface ClaimInboxTableProps {
  rows: OwnerClaimRow[];
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  disabled: boolean;
}

/** Tab "Sàn tìm thấy": tin có thể là của bạn — xác nhận để đưa vào danh mục. */
export function ClaimInboxTable({ rows, onConfirm, onReject, disabled }: ClaimInboxTableProps) {
  return (
    <table className="w-full border-collapse text-[13.5px]">
      <thead>
        <tr>
          <th className={TH}>Tài sản</th>
          <th className={TH}>Khu vực</th>
          <th className={TH}>Chủ tài sản trên tin</th>
          <th className={cn(TH, "hidden text-right md:table-cell")}>Giá</th>
          <th className={TH}>
            <span className="sr-only">Hành động</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id} className="last:[&>td]:border-b-0">
            <td className={TD}>
              <span className="block max-w-[320px] truncate text-sm font-medium">{c.title}</span>
              <small className="block whitespace-nowrap text-[12.5px] text-muted-foreground">
                Tin trên sàn{c.category && ` · ${c.category}`}
              </small>
            </td>
            <td className={TD}>
              <Stacked main={c.province ?? "—"} sub={c.branch} />
            </td>
            <td className={TD}>
              <Stacked
                className="max-w-[260px] [&>span]:truncate"
                main={c.matchedName ?? "—"}
                sub={c.score !== null ? `Khớp ${c.score}%` : undefined}
              />
            </td>
            <td className={cn(TD, "hidden text-right tabular-nums md:table-cell")}>
              <Stacked
                main={formatMoneyShort(c.price)}
                sub={c.auctionDay ? `Khởi điểm · phiên ${formatDayMonth(c.auctionDay)}` : "Khởi điểm"}
              />
            </td>
            <td className={cn(TD, "w-[1%] whitespace-nowrap text-right")}>
              {c.canWrite && (
                <div className="flex justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-[30px] px-3 text-[12.5px] font-semibold text-muted-foreground"
                    disabled={disabled}
                    onClick={() => onReject(c.id)}
                  >
                    Không phải
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-[30px] px-3 text-[12.5px] font-semibold"
                    disabled={disabled}
                    onClick={() => onConfirm(c.id)}
                  >
                    Xác nhận
                  </Button>
                </div>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
