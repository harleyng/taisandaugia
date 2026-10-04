import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MarketingPackage } from "@/hooks/useOwnerMarketingOrders";
import type { Coverage } from "@/lib/ownerSubscription/coverage";

interface OrderPaymentPreviewProps {
  pkg: MarketingPackage | null;
  /** null = gói này không dùng hạn mức gói dịch vụ. */
  coverage: Coverage | null;
  coverageText: string;
  balance: number;
}

/** Trạng thái thanh toán dự kiến — chỉ là xem trước, server quyết định khi bấm đặt. */
export function OrderPaymentPreview({ pkg, coverage, coverageText, balance }: OrderPaymentPreviewProps) {
  const navigate = useNavigate();
  if (!pkg) return null;

  if (pkg.pricing === "quote") {
    return (
      <p className="rounded-lg bg-muted px-3 py-2.5 text-[13px] text-foreground">
        Sàn sẽ báo giá theo yêu cầu của bạn. Bạn chỉ thanh toán (VNPay) khi đồng ý với báo giá.
      </p>
    );
  }

  if (coverage?.kind === "covered") {
    return <p className="rounded-lg bg-success/10 px-3 py-2.5 text-[13px] text-foreground">{coverageText}</p>;
  }
  if (coverage?.kind === "blocked") {
    return <p className="rounded-lg bg-warning/10 px-3 py-2.5 text-[13px] text-foreground">{coverageText}. Chờ kỳ làm mới hoặc nâng gói dịch vụ.</p>;
  }

  const short = balance < pkg.creditCost;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-[13px] text-foreground",
        short ? "bg-warning/10" : "bg-muted",
      )}
    >
      <span>
        {coverageText && <span className="block text-muted-foreground">{coverageText}</span>}
        Trừ <strong className="tabular-nums">{pkg.creditCost.toLocaleString("en-US")} credit</strong> khi đặt · số dư{" "}
        <span className="tabular-nums">{balance.toLocaleString("en-US")}</span>
        {short && " — chưa đủ"}
      </span>
      {short && (
        <Button type="button" size="sm" variant="outline" onClick={() => navigate("/chu-tai-san/credits")}>
          Nạp credit
        </Button>
      )}
    </div>
  );
}
