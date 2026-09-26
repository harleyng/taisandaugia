import type { ReactNode } from "react";
import { CheckCheck, Clock, Gavel, Wallet, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconTile, type OwnerTone } from "@/components/asset-owner-portal/ui/IconTile";
import { formatDayFull } from "@/lib/ownerPulse";
import type { TargetProgress } from "@/lib/ownerTargets";
import { formatMoneyShort } from "@/utils/money";

function StatLine({
  icon,
  tone = "primary",
  value,
  meta,
}: {
  icon: LucideIcon;
  tone?: OwnerTone;
  value: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <li className="flex items-center gap-3">
      <IconTile icon={icon} tone={tone} size="sm" className="p-1.5" />
      <div className="min-w-0">
        <p className="text-sm font-medium tabular-nums text-foreground">{value}</p>
        {meta && <p className="text-xs text-muted-foreground tabular-nums">{meta}</p>}
      </div>
    </li>
  );
}

const count = (n: number) => n.toLocaleString("en-US");

/** Cột phải của khối Chỉ tiêu (L3): thời gian còn lại, nhịp cần đạt, số tài sản. */
export function TargetProgressStats({ progress, className }: { progress: TargetProgress; className?: string }) {
  const { target, summary, daysLeft } = progress;
  const hasAmount = target.targetAmount !== null;
  const hasCount = target.targetCount !== null;

  return (
    <ul className={cn("space-y-3", className)}>
      <StatLine
        icon={Clock}
        value={daysLeft > 0 ? `Còn ${count(daysLeft)} ngày` : "Kỳ đã kết thúc"}
        meta={`đến ${formatDayFull(progress.periodEnd)}`}
      />

      {progress.achieved ? (
        <StatLine icon={CheckCheck} tone="success" value="Đã đạt chỉ tiêu" meta="Tiếp tục ghi thu để số liệu đầy đủ" />
      ) : hasAmount && progress.weeklyAmountPace !== null ? (
        <StatLine
          icon={Wallet}
          value={`Cần ~${formatMoneyShort(progress.weeklyAmountPace)}/tuần`}
          meta={`còn thiếu ${formatMoneyShort(progress.amountRemaining)}`}
        />
      ) : !hasAmount && progress.weeklyCountPace !== null ? (
        <StatLine
          icon={Gavel}
          value={`Cần ~${count(progress.weeklyCountPace)} tài sản/tuần`}
          meta={`còn thiếu ${count(progress.countRemaining ?? 0)} tài sản`}
        />
      ) : null}

      {hasAmount && (
        <StatLine
          icon={Gavel}
          value={
            hasCount
              ? `Tài sản đấu thành ${count(summary.soldCount)} / ${count(target.targetCount!)}`
              : `Tài sản đấu thành ${count(summary.soldCount)}`
          }
          meta={
            hasCount && progress.weeklyCountPace !== null
              ? `cần ~${count(progress.weeklyCountPace)}/tuần`
              : hasCount
                ? `đạt ${progress.countPct ?? 0}%`
                : "trong kỳ"
          }
        />
      )}
    </ul>
  );
}
