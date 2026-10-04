import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatMoneyFull } from "@/utils/money";
import type { MarketingOrder } from "@/hooks/useOwnerMarketingOrders";
import { expectedQuoteBy, isQuoteExpired, mktOrderCheckoutPath } from "@/lib/ownerMarketing/orders";
import { deltaOf, formatCount, windowDays, type OrderImpact } from "@/lib/ownerMarketing/orderReport";
import { formatHeroTime, formatShortDate } from "../format";
import { PAYMENT_LABELS, paidAmountText } from "../payment";

function Shell({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-xl bg-card px-5 py-[18px] shadow-card">{children}</div>;
}

function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[12.5px] text-muted-foreground", className)}>{children}</p>;
}

function Amount({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[32px] font-bold leading-none tracking-[-0.03em] tabular-nums text-foreground", className)}>
      {children}
    </p>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-muted px-3 py-2.5 text-[13px] text-foreground">{children}</p>;
}

/** "+5" / "−2" — chênh lệch tuyệt đối cạnh số hồ sơ đăng ký. */
const signed = (n: number) => (n >= 0 ? `+${formatCount(n)}` : `−${formatCount(-n)}`);

function ImpactSummary({ impact }: { impact: OrderImpact }) {
  const days = windowDays(impact);
  const views = deltaOf(impact.current.views, impact.previous.views);
  const saves = deltaOf(impact.current.saves, impact.previous.saves);
  const regDiff = impact.current.registrations - impact.previous.registrations;
  return (
    <Shell>
      <Label>
        Lượt xem tin {impact.window.running ? "sau" : "trong"} {days} ngày sàn chạy
      </Label>
      <div className="flex flex-wrap items-baseline gap-2.5 tabular-nums">
        <strong className="text-[40px] font-bold leading-none tracking-[-0.03em] text-primary">
          {formatCount(impact.current.views)}
        </strong>
        {views.text && (
          <em
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[13px] font-bold not-italic",
              views.direction === "down"
                ? "bg-destructive text-destructive-foreground"
                : views.direction === "up"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {views.text}
          </em>
        )}
      </div>
      <Label className="-mt-1.5 tabular-nums">
        so với {formatCount(impact.previous.views)} của {days} ngày trước đó
      </Label>
      <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 tabular-nums">
        <div>
          <Label>Hồ sơ đăng ký</Label>
          <p className="text-lg font-bold text-foreground">
            {formatCount(impact.current.registrations)}
            <span
              className={cn(
                "ml-1.5 text-[12.5px] font-semibold",
                regDiff < 0 ? "text-destructive" : regDiff > 0 ? "text-primary" : "text-muted-foreground",
              )}
            >
              {signed(regDiff)}
            </span>
          </p>
        </div>
        <div>
          <Label>Lượt lưu tin</Label>
          <p className="text-lg font-bold text-foreground">
            {formatCount(impact.current.saves)}
            {saves.text && (
              <span
                className={cn(
                  "ml-1.5 text-[12.5px] font-semibold",
                  saves.direction === "down" ? "text-destructive" : "text-primary",
                )}
              >
                {saves.text}
              </span>
            )}
          </p>
        </div>
      </div>
    </Shell>
  );
}

interface OrderHeroSideProps {
  order: MarketingOrder;
  impact: OrderImpact | null | undefined;
  impactLoading: boolean;
  /** truyen-thong:share trong phạm vi chi nhánh của đơn — được trả tiền. */
  canShare: boolean;
}

/** Thẻ trắng bên phải hero — đổi theo trạng thái: kết quả nhanh / báo giá / đã trả / lý do huỷ. */
export function OrderHeroSide({ order: o, impact, impactLoading, canShare }: OrderHeroSideProps) {
  const navigate = useNavigate();

  if (o.status === "in_progress" || o.status === "completed") {
    if (impactLoading) return <Skeleton className="h-[200px] w-full rounded-xl" />;
    if (impact) return <ImpactSummary impact={impact} />;
    return (
      <Shell>
        <Label>Tác động lên tài sản</Label>
        <p className="text-sm text-foreground">Chưa có số liệu lượt xem cho tài sản này.</p>
      </Shell>
    );
  }

  if (o.status === "quoted") {
    const expired = isQuoteExpired(o);
    const payable = canShare && !expired && o.quoted_price != null;
    return (
      <Shell>
        <Label>Báo giá của sàn</Label>
        <Amount>{formatMoneyFull(o.quoted_price)}</Amount>
        <Label className={cn("-mt-1.5 tabular-nums", expired && "font-semibold text-destructive")}>
          {expired ? "Đã hết hạn lúc" : "Hiệu lực đến"} {formatHeroTime(o.quote_expires_at)}
        </Label>
        {o.quote_note && <Note>{o.quote_note}</Note>}
        {payable && (
          <Button className="mt-auto h-10 w-full gap-1.5 text-sm" onClick={() => navigate(mktOrderCheckoutPath(o.id))}>
            <CreditCard className="h-4 w-4" strokeWidth={1.75} />
            Thanh toán qua VNPay
          </Button>
        )}
      </Shell>
    );
  }

  if (o.status === "requested") {
    return (
      <Shell>
        <Label>Báo giá dự kiến</Label>
        <Amount className="text-2xl">Trước {formatShortDate(expectedQuoteBy(o.created_at).toISOString())}</Amount>
        <Note>Bạn chưa phải trả gì. Có thể huỷ miễn phí đến khi thanh toán.</Note>
      </Shell>
    );
  }

  if (o.status === "paid") {
    const method = o.payment_method ? (PAYMENT_LABELS[o.payment_method] ?? o.payment_method) : null;
    return (
      <Shell>
        <Label>Đã thanh toán{method ? ` · ${method}` : ""}</Label>
        <Amount>{paidAmountText(o) ?? "—"}</Amount>
        <Label className="-mt-1.5 tabular-nums">{formatHeroTime(o.paid_at)}</Label>
      </Shell>
    );
  }

  // Đã huỷ.
  const cost = o.refund_note ?? (o.paid_at ? null : "Không phát sinh chi phí");
  return (
    <Shell>
      <Label>Lý do huỷ</Label>
      <p className="text-sm text-foreground">{o.cancel_reason || "Không ghi lý do."}</p>
      <Label className="tabular-nums">
        Huỷ lúc {formatHeroTime(o.cancelled_at)}
        {cost ? ` · ${cost}` : ""}
      </Label>
    </Shell>
  );
}
