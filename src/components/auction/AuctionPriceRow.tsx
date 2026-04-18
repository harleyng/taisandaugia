import { Card } from "@/components/ui/card";
import { formatPrice } from "@/utils/formatters";
import { Lock } from "lucide-react";

interface AuctionPriceRowProps {
  price: number;
  customAttributes: any;
  isUnlocked?: boolean;
  onLockedClick?: () => void;
}

const PriceCell = ({
  label,
  value,
  isHidden,
  onClick,
  highlight,
}: {
  label: string;
  value: string;
  isHidden?: boolean;
  onClick?: () => void;
  highlight?: boolean;
}) => (
  <div className={`flex flex-col items-center text-center px-2 py-3 ${highlight ? "bg-primary/5" : ""}`}>
    <span className="text-xs text-muted-foreground mb-1">{label}</span>
    {isHidden ? (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        aria-label={`Mở khóa để xem ${label}`}
      >
        <Lock className="w-3.5 h-3.5" />
        Mở khóa
      </button>
    ) : (
      <span className={`text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
    )}
  </div>
);

export const AuctionPriceRow = ({
  price,
  customAttributes: ca,
  isUnlocked = true,
  onLockedClick,
}: AuctionPriceRowProps) => {
  const fmt = (v: number | undefined | null) =>
    v != null ? formatPrice(v, "TOTAL") : "–";

  const bidStep = ca.bid_step ?? ca.step_price;
  const winPrice = ca.winning_price ?? ca.win_price;

  const cells = [
    { label: "Khởi điểm", rawValue: price, gated: false },
    { label: "Đặt trước", rawValue: ca.deposit_amount, gated: false },
    { label: "Hồ sơ", rawValue: ca.document_fee, gated: false },
    { label: "Bước giá", rawValue: bidStep, gated: false },
    { label: "Giá trúng", rawValue: winPrice, gated: true, highlight: true },
  ];

  return (
    <Card className="p-0 overflow-hidden">
      <div className="grid grid-cols-3 lg:grid-cols-5">
        {cells.map((cell, i) => {
          const noData = cell.rawValue == null;
          const hidden = !noData && cell.gated && !isUnlocked;

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
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
};
