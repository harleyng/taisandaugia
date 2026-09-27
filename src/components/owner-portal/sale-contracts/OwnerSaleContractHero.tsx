import { CalendarClock, CircleDollarSign, Coins, Gavel, Tag, User, Wallet } from "lucide-react";
import { DetailHero, type HeroStat } from "@/components/shared/DetailHero";
import { SaleStageBadge } from "@/components/sale-contracts/SaleStageBadge";
import { OWNER_SALE_ACTION_LABELS, ownerSaleActionOf } from "@/lib/saleContracts/ownerTabs";
import { saleOverdueOf } from "@/lib/saleContracts/stage";
import { formatPrice } from "@/utils/formatters";
import { formatDate } from "@/lib/dateUtils";
import type { SaleAssetSnapshot, SaleBuyerParty, SaleContractDetail } from "@/types/auction-sale-contract";

/**
 * Hero chi tiết hợp đồng mua bán phía chủ tài sản — cùng khuôn `DetailHero` với
 * chi tiết hồ sơ số hoá. Chỉ giữ thứ cần thấy ngay: giai đoạn, việc của bạn, tài
 * sản / phiên / bên mua / giá và hai con số tiền. Số dư lấy từ RPC (server tính).
 */
export function OwnerSaleContractHero({ detail }: { detail: SaleContractDetail }) {
  const { contract: c } = detail;
  const asset = (c.asset_snapshot ?? {}) as SaleAssetSnapshot;
  const buyer = (c.buyer_party ?? {}) as SaleBuyerParty;
  const overdue = saleOverdueOf(c, detail.installments).any;
  const action = ownerSaleActionOf(c);
  const session = [asset.session_code ? `Phiên ${asset.session_code}` : null, asset.lot_no ? `Lô ${asset.lot_no}` : null]
    .filter(Boolean)
    .join(" · ");

  // Hợp đồng đã huỷ thì hai con số tiền không còn ý nghĩa để theo dõi.
  const stats: HeroStat[] =
    c.status === "cancelled"
      ? []
      : [
          { icon: Wallet, label: "Đã thanh toán", value: formatPrice(Math.max(detail.net_paid, 0), "TOTAL") },
          { icon: CircleDollarSign, label: "Còn lại", value: formatPrice(Math.max(detail.balance, 0), "TOTAL") },
        ];

  return (
    <DetailHero
      status={<SaleStageBadge stage={detail.stage} overdue={overdue} />}
      badges={
        action !== "none" ? (
          <span className="rounded-full bg-accent/20 px-2.5 py-1 text-[11px] font-medium text-foreground">
            Cần bạn: {OWNER_SALE_ACTION_LABELS[action].toLowerCase()}
          </span>
        ) : null
      }
      name={`Hợp đồng ${c.code}`}
      code={c.contract_no}
      subtitle={
        <>
          {asset.title && (
            <span className="inline-flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 shrink-0" />
              {asset.title}
            </span>
          )}
          {session && (
            <span className="inline-flex items-center gap-1.5">
              <Gavel className="h-3.5 w-3.5 shrink-0" />
              {session}
            </span>
          )}
          {buyer.full_name && (
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 shrink-0" />
              Bên mua: {buyer.full_name}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5 shrink-0" />
            {formatPrice(Number(c.price), "TOTAL")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 shrink-0" />
            Lập {formatDate(c.created_at)}
          </span>
        </>
      }
      stats={stats}
    />
  );
}
