import { useMemo, useState } from "react";
import { Info, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { HeroFigure } from "@/components/asset-owner-portal/ui/HeroFigure";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import type { WorkspaceBranchOption } from "@/hooks/useOwnerWorkspaceMembers";
import { todayIso } from "@/lib/ownerOutcomeReport";
import {
  SCOPE_ALL,
  TARGET_PERIOD_LABEL,
  periodStartOf,
  type OwnerTarget,
  type TargetPeriodType,
  type TargetProgress,
} from "@/lib/ownerTargets";
import { formatMoneyShort, moneyShortParts } from "@/utils/money";
import { TargetDialog, type TargetDialogInitial } from "./TargetDialog";
import { TargetProgressStats } from "./TargetProgressStats";

interface TargetProgressBlockProps {
  workspaceId: string;
  /** Mọi chỉ tiêu (dialog cần để nhận ra chỉ tiêu đã có). */
  targets: OwnerTarget[];
  /** Tiến độ các chỉ tiêu của kỳ đang diễn ra — thứ tự của currentTargets(). */
  progress: TargetProgress[];
  branches: WorkspaceBranchOption[];
  /** Chi nhánh ưu tiên mở sẵn (phạm vi của Cán bộ). */
  preferredBranchIds: string[];
  canManage: boolean;
  loading: boolean;
}

const scopeOf = (p: TargetProgress) => p.target.branchId ?? SCOPE_ALL;
const count = (n: number) => n.toLocaleString("en-US");

/** Dòng tách số đã thu theo mức chắc chắn — chỉ các phần khác 0. */
function RecoveryBreakdown({ progress }: { progress: TargetProgress }) {
  const { recorded, estimated, awaiting } = progress.summary;
  if (!recorded && !estimated && !awaiting) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
      {recorded > 0 && <span>Đã ghi thu {formatMoneyShort(recorded)}</span>}
      {estimated > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
              Theo giá trúng {formatMoneyShort(estimated)}
              <Info className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs leading-relaxed">
            Kết quả do tổ chức đấu giá tự khai hoặc từ tin thu thập: chưa ai ghi nhận thu tiền nên tạm tính
            bằng giá trúng.
          </TooltipContent>
        </Tooltip>
      )}
      {awaiting > 0 && <span>Chờ thu {formatMoneyShort(awaiting)}</span>}
    </p>
  );
}

function TargetHero({ progress }: { progress: TargetProgress }) {
  const { target, summary } = progress;
  if (target.targetAmount !== null) {
    const collected = moneyShortParts(summary.collected);
    return (
      <HeroFigure
        label={`Đã thu · chỉ tiêu ${progress.periodLabel}`}
        value={collected.value}
        unit={collected.unit}
        progress={progress.amountPct ?? 0}
        context={`trên ${formatMoneyShort(target.targetAmount)} chỉ tiêu · đạt ${progress.amountPct ?? 0}%`}
      />
    );
  }
  return (
    <HeroFigure
      label={`Tài sản đấu thành · chỉ tiêu ${progress.periodLabel}`}
      value={count(summary.soldCount)}
      unit={`/ ${count(target.targetCount ?? 0)}`}
      progress={progress.countPct ?? 0}
      context={`đạt ${progress.countPct ?? 0}%`}
    />
  );
}

/**
 * L1 của "Nhịp đập": đã thu bao nhiêu so với chỉ tiêu kỳ này, còn mấy ngày, cần
 * nhịp bao nhiêu mỗi tuần (docs/owner-control-tower-plan.md Phase 9).
 */
export function TargetProgressBlock({
  workspaceId,
  targets,
  progress,
  branches,
  preferredBranchIds,
  canManage,
  loading,
}: TargetProgressBlockProps) {
  const [scopePick, setScopePick] = useState<string | null>(null);
  const [periodPick, setPeriodPick] = useState<TargetPeriodType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const scopes = useMemo(() => [...new Set(progress.map(scopeOf))], [progress]);
  const scope =
    (scopePick && scopes.includes(scopePick) ? scopePick : null) ??
    preferredBranchIds.find((id) => scopes.includes(id)) ??
    scopes[0] ??
    SCOPE_ALL;
  const inScope = progress.filter((p) => scopeOf(p) === scope);
  const selected = inScope.find((p) => p.target.periodType === periodPick) ?? inScope[0] ?? null;

  const branchLabel = (id: string) =>
    id === SCOPE_ALL ? "Toàn đơn vị" : branches.find((b) => b.id === id)?.label ?? "Chi nhánh";

  const today = todayIso();
  const dialogInitial: TargetDialogInitial = selected
    ? { periodType: selected.target.periodType, periodStart: selected.target.periodStart, scope }
    : { periodType: "month", periodStart: periodStartOf("month", today), scope: SCOPE_ALL };

  if (loading) {
    return <Skeleton className="h-[196px] rounded-2xl" aria-busy="true" />;
  }

  return (
    <SectionCard
      title="Chỉ tiêu"
      icon={Target}
      actions={
        canManage && selected ? (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setDialogOpen(true)}>
            Sửa chỉ tiêu
          </Button>
        ) : undefined
      }
    >
      {!selected ? (
        <EmptyState
          compact
          icon={Target}
          title="Chưa đặt chỉ tiêu cho kỳ này."
          description={
            canManage ? "Đặt chỉ tiêu thu hồi để theo dõi tiến độ mỗi ngày." : "Trưởng đơn vị chưa đặt chỉ tiêu."
          }
          action={
            canManage ? (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                Đặt chỉ tiêu
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {(inScope.length > 1 || scopes.length > 1) && (
            <div className="flex flex-wrap items-center gap-2">
              {inScope.length > 1 && (
                <ToggleGroup
                  type="single"
                  size="sm"
                  variant="outline"
                  value={selected.target.periodType}
                  onValueChange={(v) => v && setPeriodPick(v as TargetPeriodType)}
                  aria-label="Kỳ chỉ tiêu"
                >
                  {inScope.map((p) => (
                    <ToggleGroupItem key={p.target.id} value={p.target.periodType} className="h-8 px-3 text-xs">
                      {TARGET_PERIOD_LABEL[p.target.periodType]}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              )}
              {scopes.length > 1 && (
                <Select value={scope} onValueChange={setScopePick}>
                  <SelectTrigger className="h-8 w-auto min-w-[160px] max-w-full text-xs" aria-label="Phạm vi chỉ tiêu">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {scopes.map((s) => (
                      <SelectItem key={s} value={s}>
                        {branchLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-3 lg:col-span-8">
              <TargetHero progress={selected} />
              {selected.target.targetAmount !== null && <RecoveryBreakdown progress={selected} />}
            </div>
            <TargetProgressStats progress={selected} className="lg:col-span-4 lg:border-l lg:pl-6" />
          </div>
        </div>
      )}

      {canManage && (
        <TargetDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          workspaceId={workspaceId}
          targets={targets}
          branches={branches}
          initial={dialogInitial}
        />
      )}
    </SectionCard>
  );
}
