import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { TargetCrumb } from "@/components/asset-owner-portal/targets/TargetCrumb";
import { TargetDetailHeader } from "@/components/asset-owner-portal/targets/TargetDetailHeader";
import { TargetSummaryCard } from "@/components/asset-owner-portal/targets/TargetSummaryCard";
import { TargetCriterionCard } from "@/components/asset-owner-portal/targets/TargetCriterionCard";
import { TargetContributionCard } from "@/components/asset-owner-portal/targets/TargetContributionCard";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerTargetDetail } from "@/hooks/useOwnerTargets";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import {
  OWNER_TARGETS_HREF,
  TARGET_STATUS_LABEL,
  criterionBreakdown,
  ownerTargetEditHref,
  targetDisplayName,
  targetRange,
  targetScopeLabel,
  targetScopeOf,
  targetStatus,
  targetTiming,
} from "@/lib/ownerTargets";
import { targetPillKind } from "@/lib/ownerTargetView";

/** `?tieu-chi=` — tiêu chí đang xem số liệu cấu thành. */
const METRIC_PARAM = "tieu-chi";

/**
 * Chi tiết một chỉ tiêu — /chu-tai-san/chi-tieu/:id (bản thiết kế "Chi Tieu - Danh sach &
 * Chi tiet"). Tiến độ chung + thời gian, thẻ từng tiêu chí, và "Số liệu cấu thành": các
 * tài sản trong kỳ + phạm vi cộng lại thành số thực tế của tiêu chí đang chọn. Chỉ tìm
 * trong không gian đang chọn; "Sửa chỉ tiêu" cho Trưởng đơn vị khi kỳ chưa hết.
 */
const OwnerTargetDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoading: wsLoading } = useOwnerWorkspace();
  const { workspaceId, inputs, rowsByKey, progress, branches, canManage, isLoading, isError, refetch, today } =
    useOwnerTargetDetail(id);

  const metrics = progress?.criteria.map((c) => c.metric) ?? [];
  const [f, setFilter] = useUrlFilterState({ [METRIC_PARAM]: metrics[0] ?? "" }, { [METRIC_PARAM]: metrics });
  const selected = progress?.criteria.find((c) => c.metric === f[METRIC_PARAM]) ?? progress?.criteria[0] ?? null;
  const breakdown = useMemo(
    () => (progress && selected ? criterionBreakdown(selected.metric, inputs, targetRange(progress)) : null),
    [progress, selected, inputs],
  );

  if (wsLoading || (workspaceId && isLoading)) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-[60px] w-96 max-w-full" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !progress || !workspaceId) {
    return (
      <div className="space-y-5">
        <TargetCrumb />
        <EmptyState
          icon={Target}
          tone={isError ? "destructive" : "muted"}
          title={isError ? "Chưa tải được chỉ tiêu." : "Không tìm thấy chỉ tiêu"}
          description={
            isError ? undefined : "Chỉ tiêu có thể đã bị xoá, hoặc thuộc đơn vị khác với đơn vị bạn đang chọn."
          }
          action={
            isError ? (
              <Button variant="outline" onClick={refetch}>
                Thử lại
              </Button>
            ) : (
              <Button onClick={() => navigate(OWNER_TARGETS_HREF)}>Về danh sách chỉ tiêu</Button>
            )
          }
        />
      </div>
    );
  }

  const { target } = progress;
  const timing = targetTiming(target, today);
  const status = targetStatus(progress, today);
  const scopeLabel = targetScopeLabel(targetScopeOf(target), branches);
  // Kỳ đã qua chỉ xem: form chỉ có kỳ hiện tại trở đi.
  const canEdit = canManage && timing !== "past";

  return (
    <div className="space-y-5">
      <TargetCrumb trail={[{ label: TARGET_STATUS_LABEL[status] }]} />

      <TargetDetailHeader
        progress={progress}
        name={targetDisplayName(target, branches)}
        scopeLabel={scopeLabel}
        pill={targetPillKind(progress, today)}
        onEdit={canEdit ? () => navigate(ownerTargetEditHref(target.id)) : undefined}
      >
        <TargetSummaryCard progress={progress} timing={timing} today={today} />
      </TargetDetailHeader>

      {progress.criteria.length > 0 ? (
        <section aria-label="Tiêu chí" className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-base font-[650] text-foreground">
              Tiêu chí <span className="tabular-nums">· {progress.criteria.length}</span>
            </h2>
            <span className="text-[13px] text-muted-foreground">Chọn một tiêu chí để xem tài sản cấu thành số thực tế</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {progress.criteria.map((c) => (
              <TargetCriterionCard
                key={c.metric}
                criterion={c}
                timing={timing}
                daysLeft={progress.daysLeft}
                failed={status === "failed"}
                selected={c.metric === selected?.metric}
                onSelect={() => setFilter(METRIC_PARAM, c.metric)}
              />
            ))}
          </div>
        </section>
      ) : (
        <EmptyState compact icon={Target} title="Chỉ tiêu chưa có tiêu chí nào." />
      )}

      {selected && breakdown && (
        <TargetContributionCard
          key={selected.metric}
          criterion={selected}
          breakdown={breakdown}
          summary={progress.summary}
          rowsByKey={rowsByKey}
          branches={target.branchId === null && branches.length ? branches : null}
          scopeLabel={scopeLabel}
          timing={timing}
        />
      )}
    </div>
  );
};

export default OwnerTargetDetailPage;
