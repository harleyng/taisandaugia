import { Card } from "@/components/ui/card";
import { formatPrice } from "@/utils/formatters";

interface AuctionPriceRowProps {
  price: number;
  customAttributes: any;
}

const PriceCell = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col items-center text-center px-2 py-3">
    <span className="text-xs text-muted-foreground mb-1">{label}</span>
    <span className="text-sm font-bold text-foreground">{value}</span>
  </div>
);

export const AuctionPriceRow = ({ price, customAttributes: ca }: AuctionPriceRowProps) => {
  const fmt = (v: number | undefined | null) =>
    v != null ? formatPrice(v, "TOTAL") : "–";

  const bidStep = ca.bid_step ?? ca.step_price;
  const winPrice = ca.winning_price ?? ca.win_price;

  const cells = [
    { label: "Khởi điểm", value: fmt(price) },
    { label: "Đặt trước", value: fmt(ca.deposit_amount) },
    { label: "Hồ sơ", value: fmt(ca.document_fee) },
    { label: "Bước giá", value: fmt(bidStep) },
    { label: "Giá trúng", value: fmt(winPrice) },
  ];

  return (
    <Card className="p-0 overflow-hidden">
      <div className="grid grid-cols-3 lg:grid-cols-5">
        {cells.map((cell, i) => (
          <div
            key={cell.label}
            className={`${i < cells.length - 1 ? "border-r border-border" : ""} ${i >= 3 ? "border-t lg:border-t-0 border-border" : ""}`}
          >
            <PriceCell label={cell.label} value={cell.value} />
          </div>
        ))}
      </div>
    </Card>
  );
};
