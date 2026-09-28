import { BarChart3, Box, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { OVERAGE_HINTS, SUB_FEATURE_LABELS, SUB_FEATURE_UNITS, daysLeft, formatSubDate, vnToday } from "@/lib/ownerSubscription/status";
import { SUB_FEATURE_GROUPS, formatCount } from "@/lib/ownerSubscription/catalog";
import type { OwnerSubscriptionStatus, SubLine, SubVariantKey } from "@/lib/ownerSubscription/types";

const ICONS: Record<SubVariantKey, LucideIcon> = {
  scan_3d_owner: Box,
  report_portfolio_owner: BarChart3,
};

const monthLabel = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${Number(m)}/${y}`;
};

function QuotaRow({ line, live }: { line: SubLine; live: boolean }) {
  const Icon = ICONS[line.variant_key] ?? Box;
  const unlimited = line.monthly_quota === null;
  const full = live && !unlimited && line.remaining === 0;
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3.5 border-b py-3 last:border-b-0">
      <span
        className={cn(
          "grid h-11 w-11 place-items-center rounded-xl shadow-[0_1px_2px_hsl(var(--foreground)/0.06)]",
          full ? "bg-destructive/10 text-destructive" : "bg-card text-primary",
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden />
      </span>
      <span className="block text-[14.5px] font-semibold">{SUB_FEATURE_LABELS[line.variant_key] ?? line.name}</span>
      {unlimited ? (
        <span className="text-[13px] font-semibold text-primary">Không giới hạn</span>
      ) : (
        <span className="whitespace-nowrap text-right tabular-nums">
          <strong className={cn("text-lg font-bold tracking-[-0.01em]", full && "text-destructive")}>
            {formatCount(live ? Math.max(line.used, 0) : line.monthly_quota!)}
          </strong>
          <span className="text-[13px] text-muted-foreground">
            {live ? ` / ${formatCount(line.monthly_quota!)}` : ` ${SUB_FEATURE_UNITS[line.variant_key]}`}
          </span>
        </span>
      )}
    </div>
  );
}

/** Thẻ hạn mức tháng (#quota trong design): nhóm 2 cột, đã dùng / hạn mức từng tính năng. */
export function QuotaCard({ sub }: { sub: OwnerSubscriptionStatus }) {
  const live = sub.status === "active";
  const resetLeft = daysLeft(sub.next_reset_on, vnToday());
  const title = live
    ? `Hạn mức tháng ${monthLabel(sub.period_month)}`
    : sub.status === "scheduled"
      ? `Từ ${formatSubDate(sub.starts_on)}, mỗi tháng Trạm được dùng`
      : sub.status === "offered"
        ? "Khi kích hoạt, mỗi tháng Trạm được dùng"
        : "Gia hạn để dùng lại mỗi tháng";
  const note = live
    ? OVERAGE_HINTS[sub.overage_mode]
    : sub.status === "offered"
      ? "Sàn đã chào gói này cho Trạm. Trong lúc chờ, thành viên vẫn dùng credit."
      : sub.status === "expired"
        ? "Hạn mức tính lại từ ngày gia hạn."
        : OVERAGE_HINTS[sub.overage_mode];

  const groups = new Map<string, SubLine[]>();
  for (const l of sub.lines) {
    const g = SUB_FEATURE_GROUPS[l.variant_key] ?? "Khác";
    groups.set(g, [...(groups.get(g) ?? []), l]);
  }

  return (
    <section className="flex flex-col gap-3.5 rounded-2xl border bg-card px-[22px] py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {live && (
          <span className="text-[12.5px] tabular-nums text-muted-foreground">
            Làm mới {formatSubDate(sub.next_reset_on)}
            {/* daysLeft tính cả ngày cuối; ngày làm mới là ngày ĐẦU kỳ sau ⇒ trừ 1. */}
            {resetLeft !== null && resetLeft > 1 ? ` · còn ${resetLeft - 1} ngày` : ""}
          </span>
        )}
      </div>
      {sub.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">Gói chưa có tính năng nào tính hạn mức.</p>
      ) : (
        <div className="grid items-start gap-3.5 min-[860px]:grid-cols-2">
          {[...groups].map(([group, lines]) => (
            <div key={group} className="rounded-2xl bg-muted/70 px-[18px] pb-1.5 pt-4">
              <h4 className="mb-1 text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">{group}</h4>
              {lines.map((l) => (
                <QuotaRow key={l.variant_key} line={l} live={live} />
              ))}
            </div>
          ))}
        </div>
      )}
      <p className="text-[12.5px] text-muted-foreground">{note}</p>
      {live && !sub.covered_for_me && (
        <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Bạn xem Trạm này qua liên kết trụ sở — thao tác của bạn ở đây vẫn tính credit.
        </p>
      )}
    </section>
  );
}
