import { BarChart3, Box, CircleDot, Download, FileText, Mail, Star, TrendingUp, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CYCLE_LABELS, benefitValueText, formatCount } from "@/lib/ownerSubscription/benefits";
import { OVERAGE_HINTS, daysLeft, formatSubDate, vnToday } from "@/lib/ownerSubscription/status";
import type { OwnerSubscriptionStatus, SubLine } from "@/lib/ownerSubscription/types";

/** Biểu tượng theo khoá danh mục quyền lợi; khoá khác dùng CircleDot. */
const ICONS: Record<string, LucideIcon> = {
  scan_3d_owner: Box,
  report_portfolio_owner: BarChart3,
  digitize_posting: FileText,
  priority_listing: Star,
  market_report: TrendingUp,
  pdf_export: Download,
  investor_invite: Mail,
  members: Users,
};

interface QuotaRowData {
  key: string;
  icon: LucideIcon;
  label: string;
  /** Chu kỳ khác tháng: "Mỗi tuần · làm mới 06/10", "Cả kỳ gói". */
  caption: string | null;
  used: number;
  /** null = không giới hạn. */
  quota: number | null;
  /** Chữ hiện khi gói chưa hiệu lực (chưa có lượt dùng): "10 lượt quét / tháng". */
  idleText: string;
}

const monthLabel = (iso: string) => {
  const [y, m] = iso.split("-");
  return `${Number(m)}/${y}`;
};

function QuotaRow({ row, live }: { row: QuotaRowData; live: boolean }) {
  const Icon = row.icon;
  const unlimited = row.quota === null;
  const full = live && !unlimited && row.used >= row.quota!;
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
      <span className="block min-w-0">
        <span className="block text-[14.5px] font-semibold">{row.label}</span>
        {row.caption && <span className="block text-xs text-muted-foreground">{row.caption}</span>}
      </span>
      {unlimited ? (
        <span className="text-[13px] font-semibold text-primary">Không giới hạn</span>
      ) : live ? (
        <span className="whitespace-nowrap text-right tabular-nums">
          <strong className={cn("text-lg font-bold tracking-[-0.01em]", full && "text-destructive")}>
            {formatCount(Math.max(row.used, 0))}
          </strong>
          <span className="text-[13px] text-muted-foreground"> / {formatCount(row.quota!)}</span>
        </span>
      ) : (
        <span className="whitespace-nowrap text-right text-[13px] font-semibold tabular-nums">{row.idleText}</span>
      )}
    </div>
  );
}

const rowOf = (l: SubLine, live: boolean): QuotaRowData => ({
  key: l.benefit_key,
  icon: ICONS[l.benefit_key] ?? CircleDot,
  label: l.label,
  caption:
    l.cycle && l.cycle !== "month"
      ? `${CYCLE_LABELS[l.cycle]}${live && l.resets_on ? ` · làm mới ${formatSubDate(l.resets_on)}` : ""}`
      : null,
  used: l.used,
  quota: l.quota,
  idleText: benefitValueText(l),
});

/**
 * Thẻ hạn mức (#quota trong design): nhóm 2 cột, đã dùng / hạn mức từng quyền lợi có đếm
 * lượt. Mỗi quyền lợi theo chu kỳ riêng — cả thẻ theo tháng thì giữ tiêu đề "Hạn mức tháng".
 */
export function QuotaCard({ sub }: { sub: OwnerSubscriptionStatus }) {
  const live = sub.status === "active";
  const lines = sub.lines.filter((l) => l.tracked);
  const allMonthly = lines.every((l) => l.cycle === "month");
  const resetLeft = daysLeft(sub.next_reset_on, vnToday());
  const title = live
    ? allMonthly
      ? `Hạn mức tháng ${monthLabel(sub.period_month)}`
      : "Hạn mức hiện tại"
    : sub.status === "scheduled"
      ? `Từ ${formatSubDate(sub.starts_on)}, Trạm được dùng`
      : sub.status === "offered"
        ? "Khi kích hoạt, Trạm được dùng"
        : "Gia hạn để dùng lại hạn mức";
  const note = live
    ? OVERAGE_HINTS[sub.overage_mode]
    : sub.status === "offered"
      ? "Sàn đã chào gói này cho Trạm. Trong lúc chờ, thành viên vẫn dùng credit."
      : sub.status === "expired"
        ? "Hạn mức tính lại từ ngày gia hạn."
        : OVERAGE_HINTS[sub.overage_mode];

  // Nhóm theo thứ tự xuất hiện (thứ tự admin xếp trong gói).
  const groups = new Map<string, QuotaRowData[]>();
  for (const l of lines) {
    const group = l.group || "Khác";
    groups.set(group, [...(groups.get(group) ?? []), rowOf(l, live)]);
  }

  return (
    <section className="flex flex-col gap-3.5 rounded-2xl border bg-card px-[22px] py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold">{title}</h3>
        {live && allMonthly && (
          <span className="text-[12.5px] tabular-nums text-muted-foreground">
            Làm mới {formatSubDate(sub.next_reset_on)}
            {/* daysLeft tính cả ngày cuối; ngày làm mới là ngày ĐẦU kỳ sau ⇒ trừ 1. */}
            {resetLeft !== null && resetLeft > 1 ? ` · còn ${resetLeft - 1} ngày` : ""}
          </span>
        )}
      </div>
      {groups.size === 0 ? (
        <p className="text-sm text-muted-foreground">Gói chưa có quyền lợi nào đếm lượt dùng.</p>
      ) : (
        <div className="grid items-start gap-3.5 min-[860px]:grid-cols-2">
          {[...groups].map(([group, rows]) => (
            <div key={group} className="rounded-2xl bg-muted/70 px-[18px] pb-1.5 pt-4">
              <h4 className="mb-1 text-xs font-bold uppercase tracking-[0.06em] text-muted-foreground">{group}</h4>
              {rows.map((r) => (
                <QuotaRow key={r.key} row={r} live={live} />
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
