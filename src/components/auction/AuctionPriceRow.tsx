import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { formatPrice } from "@/utils/formatters";
import { Eye } from "lucide-react";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { supabase } from "@/integrations/supabase/client";

interface AuctionPriceRowProps {
  price: number;
  customAttributes: any;
}

const PriceCell = ({
  label,
  value,
  isHidden,
  onClick,
}: {
  label: string;
  value: string;
  isHidden?: boolean;
  onClick?: () => void;
}) => (
  <div className="flex flex-col items-center text-center px-2 py-3">
    <span className="text-xs text-muted-foreground mb-1">{label}</span>
    {isHidden ? (
      <button
        onClick={onClick}
        className="text-muted-foreground hover:text-primary transition-colors"
        aria-label={`Đăng nhập để xem ${label}`}
      >
        <Eye className="w-4 h-4" />
      </button>
    ) : (
      <span className="text-sm font-bold text-foreground">{value}</span>
    )}
  </div>
);

export const AuctionPriceRow = ({ price, customAttributes: ca }: AuctionPriceRowProps) => {
  const { openAuthDialog } = useAuthDialog();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const fmt = (v: number | undefined | null) =>
    v != null ? formatPrice(v, "TOTAL") : "–";

  const bidStep = ca.bid_step ?? ca.step_price;
  const winPrice = ca.winning_price ?? ca.win_price;

  const cells = [
    { label: "Khởi điểm", rawValue: price, gated: false },
    { label: "Đặt trước", rawValue: ca.deposit_amount, gated: false },
    { label: "Hồ sơ", rawValue: ca.document_fee, gated: true },
    { label: "Bước giá", rawValue: bidStep, gated: true },
    { label: "Giá trúng", rawValue: winPrice, gated: true },
  ];

  return (
    <Card className="p-0 overflow-hidden">
      <div className="grid grid-cols-3 lg:grid-cols-5">
        {cells.map((cell, i) => {
          const noData = cell.rawValue == null;
          const hidden = !noData && cell.gated && !session;

          return (
            <div
              key={cell.label}
              className={`${i < cells.length - 1 ? "border-r border-border" : ""} ${i >= 3 ? "border-t lg:border-t-0 border-border" : ""}`}
            >
              <PriceCell
                label={cell.label}
                value={noData ? "–" : fmt(cell.rawValue)}
                isHidden={hidden}
                onClick={() => openAuthDialog()}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
};
