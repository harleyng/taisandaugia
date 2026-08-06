import { Card } from "@/components/ui/card";
import { formatPrice } from "@/utils/formatters";
import { Lock } from "lucide-react";
import { caNumber, type ListingCustomAttributes } from "@/types/listing";

interface AuctionPriceRowProps {
  price: number;
  customAttributes: ListingCustomAttributes | null;
  isUnlocked?: boolean;
  isLoggedIn?: boolean;
  onLockedClick?: () => void;
  onLoginClick?: () => void;
}

const PriceCell = ({
  label,
  value,
  isHidden,
  onClick,
  onLoginClick,
  highlight,
}: {
  label: string;
  value: string;
  isHidden?: boolean;
  onClick?: () => void;
  onLoginClick?: () => void;
  highlight?: boolean;
}) => (
  isHidden ? (
    <button
      type="button"
      onClick={onLoginClick ?? onClick}
      aria-label={`Đăng nhập để xem ${label}`}
      className={`flex flex-col items-center text-center px-2 py-3 w-full h-full transition-colors hover:bg-primary/10 ${highlight ? "bg-primary/5" : ""}`}
    >
      <span className="text-xs text-muted-foreground mb-1">{label}</span>
      <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
        <Lock className="w-3.5 h-3.5" />
        Đăng nhập
      </span>
    </button>
  ) : (
    <div className={`flex flex-col items-center text-center px-2 py-3 ${highlight ? "bg-primary/5" : ""}`}>
      <span className="text-xs text-muted-foreground mb-1">{label}</span>
      <span className={`text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  )
);

export const AuctionPriceRow = ({
  price,
  customAttributes: ca,
  isUnlocked = true,
  isLoggedIn = true,
  onLockedClick,
  onLoginClick,
}: AuctionPriceRowProps) => {
  const fmt = (v: number | undefined | null) =>
    v != null ? formatPrice(v, "TOTAL") : "–";

  const attrs = ca ?? {};
  const bidStep = caNumber(attrs.bid_step ?? attrs.step_price);
  const winPrice = caNumber(attrs.winning_price ?? attrs.win_price);

  const cells = [
    { label: "Khởi điểm", rawValue: price, gated: false, loginRequired: false },
    { label: "Đặt trước", rawValue: caNumber(attrs.deposit_amount), gated: false, loginRequired: false },
    { label: "Hồ sơ", rawValue: caNumber(attrs.document_fee), gated: false, loginRequired: true },
    { label: "Bước giá", rawValue: bidStep, gated: false, loginRequired: true },
    { label: "Giá trúng", rawValue: winPrice, gated: true, loginRequired: false, highlight: true },
  ];

  return (
    <Card className="p-0 overflow-hidden">
      <div className="grid grid-cols-3 lg:grid-cols-5">
        {cells.map((cell, i) => {
          const noData = cell.rawValue == null;
          const hidden = !noData && ((cell.gated && !isUnlocked) || (cell.loginRequired && !isLoggedIn));

          return (
            <div
              key={cell.label}
              className={`${i < cells.length - 1 ? "border-r border-border" : ""} ${i >= 3 ? "border-t lg:border-t-0 border-border" : ""}`}
            >
              <PriceCell
                label={cell.label}
                value={noData ? "–" : fmt(cell.rawValue)}
                isHidden={hidden}
                highlight={cell.highlight}
                onClick={onLockedClick}
                onLoginClick={onLoginClick}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
};
