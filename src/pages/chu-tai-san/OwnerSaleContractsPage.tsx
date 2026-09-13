import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SaleStageBadge } from "@/components/sale-contracts/SaleStageBadge";
import { useOwnerSaleContracts } from "@/hooks/useSaleContracts";
import { ownerSaleContractPath } from "@/lib/saleContracts/files";
import { awaitingSigningSides, canConfirmHandover, saleStageOf } from "@/lib/saleContracts/stage";
import { formatVnd } from "@/lib/advertising/slug";
import type { SaleAssetSnapshot, SaleBuyerParty } from "@/types/auction-sale-contract";

/**
 * /chu-tai-san/hop-dong-mua-ban — hợp đồng mà chủ tài sản là BÊN BÁN.
 *
 * Chỉ hiện với lô đến từ hồ sơ ký gửi: lô tin đăng có bên bán là thực thể danh
 * bạ không có tài khoản, tổ chức ký thay nên không có gì để chủ tài sản làm.
 */
export default function OwnerSaleContractsPage() {
  const navigate = useNavigate();
  const { data: rows = [], isLoading, error } = useOwnerSaleContracts();

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Hợp đồng mua bán</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hợp đồng bán tài sản của bạn cho người trúng đấu giá.
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Đang tải…
        </div>
      ) : error ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-destructive">
          Không tải được danh sách hợp đồng. Vui lòng thử lại.
        </Card>
      ) : rows.length === 0 ? (
        <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Bạn chưa có hợp đồng mua bán nào. Sau khi tài sản đấu giá thành, tổ chức đấu giá sẽ lập hợp
          đồng và gửi cho bạn tại đây.
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => {
            const asset = (c.asset_snapshot ?? {}) as SaleAssetSnapshot;
            const buyer = (c.buyer_party ?? {}) as SaleBuyerParty;
            const stage = saleStageOf(c);
            const needsSign = awaitingSigningSides(c).includes("seller");
            const needsHandover = canConfirmHandover(c, "seller") && !!c.paid_at;
            return (
              <Card key={c.id} className="rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.code}</span>
                      <SaleStageBadge stage={stage} />
                      {needsSign ? (
                        <Badge variant="outline" className="border-accent/40 bg-accent/15">
                          cần bạn xác nhận bản ký
                        </Badge>
                      ) : null}
                      {needsHandover ? (
                        <Badge variant="outline" className="border-accent/40 bg-accent/15">
                          cần xác nhận bàn giao
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm">{asset.title ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        asset.session_code ? `Phiên ${asset.session_code}` : null,
                        buyer.full_name ? `Bên mua: ${buyer.full_name}` : null,
                        `Giá ${formatVnd(c.price)}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Button type="button" size="sm" onClick={() => navigate(ownerSaleContractPath(c.id))}>
                    Xem hợp đồng
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
