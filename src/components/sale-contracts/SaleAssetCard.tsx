import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDate } from "@/lib/dateUtils";
import type { SaleAssetSnapshot, SaleContract } from "@/types/auction-sale-contract";

const DASH = "—";
const val = (v?: string | number | null) =>
  v === null || v === undefined || String(v).trim() === "" ? DASH : String(v);

/** Bản chiếu tài sản + giá — đóng băng lúc lập hợp đồng, không đọc bảng sống. */
export function SaleAssetCard({ contract }: { contract: SaleContract }) {
  const a = (contract.asset_snapshot ?? {}) as SaleAssetSnapshot;
  const payable = Number(contract.price) - Number(contract.deposit_credit);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Tài sản và giá mua</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-medium">{val(a.title)}</p>
          <p className="text-sm text-muted-foreground">
            {[a.session_code ? `Phiên ${a.session_code}` : null, a.lot_no ? `Lô ${a.lot_no}` : null,
              [a.district, a.province].filter(Boolean).join(", ") || null]
              .filter(Boolean)
              .join(" · ") || DASH}
          </p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Giá trúng đấu giá</dt>
            <dd className="text-lg font-semibold">{formatVnd(contract.price)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Tiền đặt trước đã chuyển</dt>
            <dd className="text-lg font-semibold">{formatVnd(contract.deposit_credit)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Còn phải thanh toán</dt>
            <dd className="text-lg font-semibold text-primary">{formatVnd(payable)}</dd>
          </div>
        </dl>

        {a.session_ends_at ? (
          <p className="text-xs text-muted-foreground">
            Cuộc đấu giá kết thúc ngày {formatDate(a.session_ends_at)}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
