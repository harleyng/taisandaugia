import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SaleStageBadge } from "@/components/sale-contracts/SaleStageBadge";
import { useOrgSaleContracts } from "@/hooks/useSaleContracts";
import { PORTAL_SALE_CONTRACTS_PATH, portalSaleContractPath } from "@/lib/saleContracts/files";
import { saleStageOf } from "@/lib/saleContracts/stage";
import { formatVnd } from "@/lib/advertising/slug";
import type { SaleAssetSnapshot } from "@/types/auction-sale-contract";

/**
 * Tóm tắt hợp đồng mua bán của phiên — chỉ hiện sau khi đã chốt kết quả.
 * Lập hợp đồng vẫn làm ở phòng điều hành; đây là lối tra cứu nhanh.
 */
export function SessionSaleContractsCard({
  sessionId,
  organizationId,
}: {
  sessionId: string;
  organizationId: string;
}) {
  const navigate = useNavigate();
  const { data: all = [] } = useOrgSaleContracts(organizationId);
  const rows = all.filter((c) => c.session_id === sessionId);

  if (rows.length === 0) return null;

  return (
    <Card className="rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-foreground">Hợp đồng mua bán</h2>
          <p className="text-sm text-muted-foreground">
            {rows.length} hợp đồng được lập từ kết quả của phiên này.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => navigate(`${PORTAL_SALE_CONTRACTS_PATH}?session=${sessionId}`)}
        >
          Xem tất cả
        </Button>
      </div>

      <ul className="space-y-2">
        {rows.map((c) => {
          const asset = (c.asset_snapshot ?? {}) as SaleAssetSnapshot;
          return (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {c.code}
                  {asset.lot_no ? ` · Lô ${asset.lot_no}` : ""}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {asset.title ?? "—"} — {formatVnd(c.price)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <SaleStageBadge stage={saleStageOf(c)} />
                <Button type="button" size="sm" variant="ghost" onClick={() => navigate(portalSaleContractPath(c.id))}>
                  Mở
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
