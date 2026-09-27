import { ChartColumnDecreasing } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import type { WaterfallStep, WaterfallTotals } from "@/lib/ownerCashFlow";
import { formatMoneyShort } from "@/utils/money";

interface CashRecoveryBarsProps {
  totals: WaterfallTotals;
  steps: WaterfallStep[];
}

const signed = (v: number) => (v < 0 ? `−${formatMoneyShort(-v)}` : formatMoneyShort(v));

/**
 * "Từ giá trúng đến thực nhận": thác tiền ngang vẽ bằng HTML (design 2026-09-27) —
 * mọi bậc đều có nhãn và số in sẵn nên thanh chỉ là trang trí (aria-hidden).
 * Màu theo vai trò bậc: tổng = primary, giảm = xám trung tính (không dùng success cạnh primary).
 */
export function CashRecoveryBars({ totals, steps }: CashRecoveryBarsProps) {
  const notes = [
    totals.notes.defaulted ? `Không tính ${totals.notes.defaulted} tài sản người trúng bỏ cọc.` : null,
    totals.notes.overpaid ? `Có ${formatMoneyShort(totals.notes.overpaid)} thu vượt giá trúng — nên xem lại sổ thu chi.` : null,
  ].filter(Boolean);

  // Thực nhận có thể âm (phí lớn hơn số đã thu) ⇒ trục bắt đầu từ giá trị nhỏ nhất.
  const lo = Math.min(0, ...steps.map((s) => s.range[0]));
  const hi = Math.max(0, ...steps.map((s) => s.range[1]));
  const span = hi - lo || 1;

  return (
    <SectionCard title="Từ giá trúng đến thực nhận" icon={ChartColumnDecreasing}>
      {totals.count === 0 ? (
        <EmptyState
          compact
          icon={ChartColumnDecreasing}
          title="Chưa có phiên bán nào đơn vị tự theo dõi tiền trong kỳ."
          description="Khai kết quả phiên thành rồi ghi các khoản thu để thấy tiền đi từ giá trúng tới thực nhận."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {totals.count} tài sản bán trong kỳ (theo ngày phiên) · số đã thu tính tới hôm nay
          </p>
          <ul className="space-y-2.5">
            {steps.map((s) => {
              const total = s.kind === "total";
              const width = ((s.range[1] - s.range[0]) / span) * 100;
              return (
                <li
                  key={s.key}
                  className="grid grid-cols-[6.5rem_minmax(0,1fr)_4.75rem] items-center gap-3 text-sm sm:grid-cols-[8rem_minmax(0,1fr)_5.5rem]"
                >
                  <span className={cn("text-right", total ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    {s.label}
                  </span>
                  <span className="relative h-5" aria-hidden="true">
                    {width > 0 && (
                      <span
                        className={cn("absolute inset-y-0 rounded", total ? "bg-primary" : "bg-muted-foreground/30")}
                        style={{ left: `${((s.range[0] - lo) / span) * 100}%`, width: `max(${width}%, 2px)` }}
                      />
                    )}
                  </span>
                  <span className={cn("whitespace-nowrap tabular-nums", total ? "font-semibold text-foreground" : "text-muted-foreground")}>
                    {signed(s.value)}
                  </span>
                </li>
              );
            })}
          </ul>
          {notes.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </SectionCard>
  );
}
