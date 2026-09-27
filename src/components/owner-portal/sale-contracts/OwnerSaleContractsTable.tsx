import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { SaleStageBadge } from "@/components/sale-contracts/SaleStageBadge";
import { ownerSaleContractPath } from "@/lib/saleContracts/files";
import { nextStepText, saleOverdueOf, saleStageOf } from "@/lib/saleContracts/stage";
import { OWNER_SALE_ACTION_LABELS, ownerSaleActionOf } from "@/lib/saleContracts/ownerTabs";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDate } from "@/lib/dateUtils";
import type { SaleAssetSnapshot, SaleBuyerParty, SaleContract } from "@/types/auction-sale-contract";

/** Hạn gần nhất đáng nhắc ở cột giá — theo giai đoạn đang chạy. */
function dueNote(c: SaleContract): string {
  const stage = saleStageOf(c);
  if (stage === "signing" && c.sign_due_at) return `Hạn ký ${formatDate(c.sign_due_at)}`;
  if (stage === "handover" && c.handover_due_at) return `Hạn bàn giao ${formatDate(c.handover_due_at)}`;
  return "";
}

/**
 * Bảng hợp đồng mua bán phía chủ tài sản (bên bán). Cả dòng bấm được; ô mã hợp
 * đồng là nút thật để dùng được bằng bàn phím.
 */
export function OwnerSaleContractsTable({ rows, emptyText }: { rows: SaleContract[]; emptyText: string }) {
  const navigate = useNavigate();

  if (rows.length === 0) {
    return <p className="px-4 py-12 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Hợp đồng</th>
            <th className="px-4 py-3 font-medium">Tài sản</th>
            <th className="px-4 py-3 font-medium">Bên mua</th>
            <th className="px-4 py-3 text-right font-medium">Giá mua</th>
            <th className="px-4 py-3 font-medium">Giai đoạn</th>
            <th className="px-4 py-3 font-medium">Việc cần làm</th>
            <th className="w-8 px-2 py-3" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const asset = (c.asset_snapshot ?? {}) as SaleAssetSnapshot;
            const buyer = (c.buyer_party ?? {}) as SaleBuyerParty;
            const stage = saleStageOf(c);
            const overdue = saleOverdueOf(c, []).any;
            const action = ownerSaleActionOf(c);
            const open = () => navigate(ownerSaleContractPath(c.id));
            return (
              <tr
                key={c.id}
                onClick={open}
                className="cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40"
              >
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      open();
                    }}
                    className="font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                  >
                    {c.code}
                  </button>
                  <div className="text-xs text-muted-foreground">
                    {c.contract_no ? `Số ${c.contract_no}` : `Lập ${formatDate(c.created_at)}`}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-[16rem] truncate">{asset.title ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {[asset.session_code ? `Phiên ${asset.session_code}` : null, asset.lot_no ? `Lô ${asset.lot_no}` : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-[11rem] truncate">{buyer.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {buyer.bidder_no ? `SBD ${buyer.bidder_no}` : "—"}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="font-medium">{formatVnd(c.price)}</div>
                  <div className={overdue ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                    {dueNote(c)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <SaleStageBadge stage={stage} overdue={overdue} />
                </td>
                <td className="px-4 py-3">
                  {action !== "none" ? (
                    <span className="inline-flex rounded-full bg-accent/20 px-2.5 py-1 text-[11px] font-medium text-foreground">
                      {OWNER_SALE_ACTION_LABELS[action]}
                    </span>
                  ) : (
                    <span className="block max-w-[14rem] text-xs text-muted-foreground">{nextStepText(c)}</span>
                  )}
                </td>
                <td className="px-2 py-3">
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" aria-hidden />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
