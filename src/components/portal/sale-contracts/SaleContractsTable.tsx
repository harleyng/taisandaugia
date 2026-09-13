import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SaleStageBadge } from "@/components/sale-contracts/SaleStageBadge";
import { portalSaleContractPath } from "@/lib/saleContracts/files";
import { saleOverdueOf, saleStageOf } from "@/lib/saleContracts/stage";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDate } from "@/lib/dateUtils";
import type { SaleAssetSnapshot, SaleBuyerParty, SaleContract } from "@/types/auction-sale-contract";

/**
 * Sáu cột là trần — bảng nằm trong khung nội dung ~1000px của cổng, thêm cột
 * nữa là cột thao tác bị cắt (bài học của WinnerPaymentCard).
 */
export function SaleContractsTable({ rows }: { rows: SaleContract[] }) {
  const navigate = useNavigate();

  if (rows.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        Không có hợp đồng nào khớp bộ lọc.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Hợp đồng</th>
            <th className="px-4 py-3 font-medium">Lô / Tài sản</th>
            <th className="px-4 py-3 font-medium">Bên mua</th>
            <th className="px-4 py-3 text-right font-medium">Giá mua</th>
            <th className="px-4 py-3 font-medium">Giai đoạn</th>
            <th className="px-4 py-3 text-right font-medium">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const asset = (c.asset_snapshot ?? {}) as SaleAssetSnapshot;
            const buyer = (c.buyer_party ?? {}) as SaleBuyerParty;
            const stage = saleStageOf(c);
            const overdue = saleOverdueOf(c, []).any;
            return (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div className="font-medium">{c.code}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.contract_no || asset.session_code || "—"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-[16rem] truncate">{asset.title ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {asset.lot_no ? `Lô ${asset.lot_no}` : "—"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-[11rem] truncate">{buyer.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {buyer.bidder_no ? `SBD ${buyer.bidder_no}` : "—"}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div>{formatVnd(c.price)}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.sign_due_at && stage === "signing" ? `hạn ký ${formatDate(c.sign_due_at)}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <SaleStageBadge stage={stage} overdue={overdue} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(portalSaleContractPath(c.id))}
                  >
                    Mở
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
