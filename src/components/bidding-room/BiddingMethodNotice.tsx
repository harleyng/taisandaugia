import { ArrowUpRight, EyeOff, TrendingDown, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  BIDDING_METHOD_DESCRIPTIONS,
  BIDDING_METHOD_LABELS,
  BIDDING_METHODS,
  type BiddingMethod,
} from "@/lib/bidding/methods";

const ICON: Record<BiddingMethod, LucideIcon> = {
  ascending: ArrowUpRight,
  descending: TrendingDown,
  sealed: EyeOff,
};

/**
 * Phương thức trả giá của phiên (20261018190000) — thẻ đầu cột trái phòng đấu giá.
 * Có `method` ⇒ chỉ giải thích phương thức đó; không có (phương thức lạ) ⇒ liệt kê ba phương thức
 * sàn hỗ trợ.
 */
export function BiddingMethodNotice({ method }: { method?: BiddingMethod }) {
  if (!method) {
    return (
      <Card className="space-y-2 rounded-2xl p-4">
        {BIDDING_METHODS.map((m) => {
          const Icon = ICON[m];
          return (
            <div key={m} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{BIDDING_METHOD_LABELS[m]}</span>
            </div>
          );
        })}
      </Card>
    );
  }

  const Icon = ICON[method];
  return (
    <Card className="rounded-[14px] p-4 shadow-card">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{BIDDING_METHOD_LABELS[method]}</p>
          <p className="text-xs text-muted-foreground">{BIDDING_METHOD_DESCRIPTIONS[method]}</p>
        </div>
      </div>
    </Card>
  );
}
