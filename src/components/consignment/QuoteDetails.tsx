import { AlertTriangle } from "lucide-react";
import { DEPOSIT_LEGAL_RANGE } from "@/constants/quote-plan";
import { depositOutOfLegalRange, feeTotal, feeTotalRequired, planSummary } from "@/lib/quotePlan";
import { formatVnd } from "@/lib/advertising/slug";
import type { QuoteFeeItem, QuotePlan } from "@/types/consignment";

interface QuoteDetailsProps {
  plan: QuotePlan | null;
  feeItems: QuoteFeeItem[] | null;
  /** Giá khởi điểm của hồ sơ — để quy tiền đặt trước theo % ra VNĐ. */
  startingPrice?: number | null;
  className?: string;
}

/**
 * Phương án tổ chức đấu giá + bảng chi phí của MỘT báo giá.
 *
 * Dùng chung cho cả hai phía — hộp thư của tổ chức (RequestDetailSheet) và màn
 * so sánh của chủ tài sản (QuoteComparison) — để hai bên đọc đúng cùng một thứ
 * tự, cùng cách tính tổng. Báo giá cũ chưa có phương án thì không hiện gì.
 */
export function QuoteDetails({ plan, feeItems, startingPrice, className }: QuoteDetailsProps) {
  const rows = planSummary(plan, startingPrice);
  const items = feeItems ?? [];
  const required = feeTotalRequired(items);
  const all = feeTotal(items);
  const depositWarning = depositOutOfLegalRange(plan, startingPrice);

  if (rows.length === 0 && items.length === 0) return null;

  return (
    <div className={className}>
      {rows.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Phương án tổ chức đấu giá
          </h4>
          <dl className="space-y-1.5">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-4 text-sm">
                <dt className="shrink-0 text-muted-foreground">{r.label}</dt>
                <dd className="text-right font-medium text-foreground">{r.value}</dd>
              </div>
            ))}
          </dl>
          {depositWarning && (
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Tiền đặt trước ngoài khung {DEPOSIT_LEGAL_RANGE.min}–{DEPOSIT_LEGAL_RANGE.max}% giá khởi điểm theo Luật
              Đấu giá tài sản.
            </p>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className={`space-y-2 ${rows.length > 0 ? "mt-4" : ""}`}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chi phí</h4>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {items.map((item, i) => (
                  <tr key={`${item.key}-${i}`}>
                    <td className="px-3 py-2">
                      {item.label}
                      {item.optional && (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                          Tuỳ chọn
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium">{formatVnd(item.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-muted/30 font-semibold">
                  <td className="px-3 py-2">Tổng phí bắt buộc</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{formatVnd(required)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {all !== required && (
            <p className="text-xs text-muted-foreground">
              Khoản tuỳ chọn ({formatVnd(all - required)}) không nằm trong tổng trên.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
