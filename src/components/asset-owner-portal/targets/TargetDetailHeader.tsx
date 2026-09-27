import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDayFull } from "@/lib/ownerPulse";
import type { TargetProgress } from "@/lib/ownerTargets";
import { periodTitle, type TargetPillKind } from "@/lib/ownerTargetView";
import { PeriodTile } from "./PeriodTile";
import { TargetScopeLabel } from "./TargetScopeLabel";
import { TargetStatusPill } from "./TargetStatusPill";

interface TargetDetailHeaderProps {
  progress: TargetProgress;
  name: string;
  scopeLabel: string;
  pill: TargetPillKind;
  /** Có ⇒ nút "Sửa chỉ tiêu" (Trưởng đơn vị, kỳ chưa hết). */
  onEdit?: () => void;
  /** Dải tóm tắt ở đáy thẻ (TargetSummaryCard). */
  children?: ReactNode;
}

/**
 * Thẻ hero đầu trang chi tiết (cùng khuôn với Số hoá / Ký gửi): ô kỳ lớn + tên +
 * (trạng thái · kỳ · khoảng ngày · phạm vi) + nút sửa; dải tóm tắt nằm ở đáy thẻ.
 */
export function TargetDetailHeader({ progress: p, name, scopeLabel, pill, onEdit, children }: TargetDetailHeaderProps) {
  const { target } = p;
  return (
    <section aria-label="Tổng quan chỉ tiêu" className="overflow-hidden rounded-2xl bg-card shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6 sm:py-[22px]">
        <div className="flex min-w-0 items-center gap-4">
          <PeriodTile type={target.periodType} start={target.periodStart} size="header" />
          <div className="min-w-0">
            <h1 className="text-[23px] font-bold tracking-[-0.015em] text-foreground">{name}</h1>
            <div className="mt-[5px] flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[13px] text-muted-foreground">
              <TargetStatusPill kind={pill} />
              <span className="tabular-nums">
                {periodTitle(target.periodType, target.periodStart)} · {formatDayFull(target.periodStart)} –{" "}
                {formatDayFull(p.periodEnd)}
              </span>
              <TargetScopeLabel label={scopeLabel} branch={target.branchId !== null} />
            </div>
          </div>
        </div>
        {onEdit && (
          <Button variant="outline" className="h-9 gap-1.5 bg-card text-[13px] font-semibold" onClick={onEdit}>
            <Pencil className="h-4 w-4" strokeWidth={1.75} />
            Sửa chỉ tiêu
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}
