import type { ReactNode } from "react";
import { formatDayMonth } from "@/lib/ownerPulse";
import type { TargetProgress } from "@/lib/ownerTargets";
import { formatMoneyShort } from "@/utils/money";

const count = (n: number) => n.toLocaleString("en-US");

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0">
      <small className="block text-[12.5px] text-muted-foreground">{label}</small>
      <b className="block truncate text-xl font-bold tabular-nums text-foreground">{value}</b>
      <small className="block text-[12.5px] text-muted-foreground">{note}</small>
    </div>
  );
}

const Strong = ({ children }: { children: ReactNode }) => <b className="font-bold tabular-nums">{children}</b>;

/** Câu gợi ý dưới thẻ: tiền đang chờ có đủ lấp khoảng thiếu không. */
function hint(progress: TargetProgress): ReactNode {
  if (progress.achieved) return "Đã đạt chỉ tiêu — tiếp tục ghi thu để số liệu đầy đủ.";
  if (progress.target.targetAmount === null) {
    return progress.weeklyCountPace !== null ? (
      <>
        Cần thêm ~<Strong>{count(progress.weeklyCountPace)} tài sản</Strong> đấu thành mỗi tuần để đạt chỉ tiêu.
      </>
    ) : (
      "Mỗi tài sản đấu thành trong kỳ được tính vào chỉ tiêu."
    );
  }
  const gap = progress.amountRemaining ?? 0;
  const awaiting = progress.summary.awaiting;
  if (awaiting >= gap) {
    return (
      <>
        Thu đủ <Strong>{formatMoneyShort(awaiting)}</Strong> đang chờ để đạt chỉ tiêu.
      </>
    );
  }
  if (awaiting > 0) {
    return (
      <>
        Thu đủ <Strong>{formatMoneyShort(awaiting)}</Strong> đang chờ, vẫn còn thiếu{" "}
        <Strong>{formatMoneyShort(gap - awaiting)}</Strong>.
      </>
    );
  }
  return "Chưa có khoản nào chờ thu — cần thêm phiên đấu thành.";
}

/** Thẻ trắng bên phải khối Chỉ tiêu: còn lại · còn thiếu, và gợi ý để đạt. */
export function TargetGapCard({ progress }: { progress: TargetProgress }) {
  const byAmount = progress.target.targetAmount !== null;
  const gap = byAmount
    ? formatMoneyShort(progress.amountRemaining ?? 0)
    : `${count(progress.countRemaining ?? 0)} tài sản`;

  return (
    <div className="flex flex-col gap-3.5 rounded-xl bg-card px-5 py-[18px] shadow-card">
      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Còn lại"
          value={progress.daysLeft > 0 ? `${count(progress.daysLeft)} ngày` : "Hết kỳ"}
          note={`đến ${formatDayMonth(progress.periodEnd)}`}
        />
        {progress.achieved ? (
          <Stat label="Đã đạt" value={`${byAmount ? progress.amountPct ?? 0 : progress.countPct ?? 0}%`} note="chỉ tiêu kỳ này" />
        ) : (
          <Stat label="Còn thiếu" value={gap} note="để đạt 100%" />
        )}
      </div>
      <p className="rounded-lg bg-primary/[0.08] px-3 py-2.5 text-[13px] leading-normal text-primary-hover">
        {hint(progress)}
      </p>
    </div>
  );
}
