import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { HeroFigure } from "@/components/asset-owner-portal/ui/HeroFigure";
import { OwnerFilterBar } from "@/components/asset-owner-portal/ui/OwnerFilterBar";
import { OwnerFilterSelect } from "@/components/asset-owner-portal/ui/OwnerFilterSelect";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { ReadOnlyNote } from "@/components/asset-owner-portal/pulse/PulseListParts";
import { MoveForecastDialog, type MoveForecastTarget } from "@/components/asset-owner-portal/auction-plan/period/MoveForecastDialog";
import { PlanDueStepList } from "@/components/asset-owner-portal/auction-plan/period/PlanDueStepList";
import { PlanMonthItemList } from "@/components/asset-owner-portal/auction-plan/period/PlanMonthItemList";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import {
  useMarkDueStepDone,
  usePlanMonthBoard,
  type PlanDueStep,
  type PlanMonthItem,
} from "@/hooks/useAuctionPlanPeriod";
import { monthStartIso, planHealthToday } from "@/lib/auctionPlan/health";
import { planPeriodKey } from "@/lib/auctionPlan/period";
import { ownerPlanTabHref } from "@/lib/auctionPlan/routes";
import { monthLabel } from "@/lib/auctionPlan/totals";

/** 24 tháng quanh hôm nay — đủ để xem lại kỳ cũ và dọn việc tháng tới. */
function monthChoices(today: string): { key: string; start: string; label: string }[] {
  const base = Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1;
  return Array.from({ length: 24 }, (_, i) => {
    const total = base - 6 + i;
    const start = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
    return { key: planPeriodKey({ type: "month", start }), start, label: `tháng ${monthLabel(start)}` };
  });
}

/**
 * "Vận hành tháng" — /chu-tai-san/ke-hoach/van-hanh?ky=2026-11 (A6).
 *
 * L1 câu trả lời của tháng · L2 mốc quá hạn rồi mốc đến hạn trong tháng (thẻ
 * mang nút của chính nó) · L3 tài sản cần đấu giá trong tháng · L4 xem trước
 * tháng sau.
 *
 * Trang gom việc của MỌI kế hoạch chưa đóng trong Trạm; phạm vi chi nhánh do
 * RLS quyết (`auction_plan_due_steps` là SECURITY INVOKER), nên cán bộ xã chỉ
 * thấy việc của xã mình mà client không phải lọc gì.
 */
const OwnerPlanOperationsPage = () => {
  const navigate = useNavigate();
  const { workspaceId, can, isLoading: wsLoading } = useOwnerWorkspace();
  const today = useMemo(() => planHealthToday(), []);
  const choices = useMemo(() => monthChoices(today), [today]);
  const [filters, setFilter] = useUrlFilterState(
    { ky: planPeriodKey({ type: "month", start: monthStartIso(today) ?? today }) },
    { ky: choices.map((c) => c.key) },
  );
  const current = choices.find((c) => c.key === filters.ky) ?? choices[6];

  const board = usePlanMonthBoard(workspaceId, current.start);
  const canUpdate = can("ke-hoach", "update");
  const markM = useMarkDueStepDone(workspaceId);
  const [moving, setMoving] = useState<MoveForecastTarget | null>(null);

  const openPlan = (planId: string) => navigate(ownerPlanTabHref(planId, "tien-do"));
  const openStep = (s: PlanDueStep) => openPlan(s.plan_id);
  const openItem = (i: PlanMonthItem) => openPlan(i.plan_id);
  const moveItem = (i: PlanMonthItem) =>
    setMoving({
      planId: i.plan_id,
      itemId: i.item_id,
      itemTitle: i.item_title,
      baselineMonth: i.baseline_month,
      forecastMonth: i.forecast_month,
    });

  if (wsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <OwnerNoWorkspaceState icon={ListChecks}>
        <EmptyState
          icon={ListChecks}
          title="Chưa có không gian làm việc"
          description="Vận hành kế hoạch đấu giá dành cho đơn vị đã xác thực, hoặc người được một đơn vị mời vào."
          action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Xác thực tổ chức</Button>}
        />
      </OwnerNoWorkspaceState>
    );
  }

  const late = board.items.filter((i) => i.health === "late" || i.health === "at_risk").length;

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Vận hành tháng"
        subtitle="Mốc công việc đến hạn và tài sản cần đấu giá trong tháng, trên mọi kế hoạch của đơn vị"
        actions={canUpdate ? undefined : <ReadOnlyNote>Bạn chỉ có quyền xem kế hoạch.</ReadOnlyNote>}
      />

      <OwnerFilterBar>
        <OwnerFilterSelect label="Kỳ" value={current.key} onValueChange={(v) => setFilter("ky", v)}>
          {choices.map((c) => (
            <SelectItem key={c.key} value={c.key}>
              {c.label}
            </SelectItem>
          ))}
        </OwnerFilterSelect>
      </OwnerFilterBar>

      {board.isError ? (
        <EmptyState icon={ListChecks} tone="destructive" title="Chưa tải được việc của tháng." />
      ) : board.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <HeroFigure
            label={`Tháng ${monthLabel(current.start)}`}
            value={String(board.items.length)}
            unit="tài sản cần đấu giá"
            context={
              <span>
                {board.overdue.length > 0 ? `${board.overdue.length} mốc đã quá hạn` : "Không có mốc nào quá hạn"}
                {` · ${board.dueSoon.length} mốc đến hạn trong tháng`}
                {late > 0 ? ` · ${late} tài sản trễ hoặc có nguy cơ trễ` : ""}
              </span>
            }
          />

          <PlanDueStepList
            title="Mốc đã quá hạn"
            steps={board.overdue}
            tone="destructive"
            emptyTitle="Không có mốc nào quá hạn — tốt lắm."
            canUpdate={canUpdate}
            pendingId={markM.isPending ? markM.variables?.step_id ?? null : null}
            onDone={(s) => markM.mutate(s)}
            onOpen={openStep}
          />

          <PlanDueStepList
            title="Mốc đến hạn trong tháng"
            steps={board.dueSoon}
            tone="warning"
            emptyTitle="Tháng này không còn mốc nào đến hạn."
            canUpdate={canUpdate}
            pendingId={markM.isPending ? markM.variables?.step_id ?? null : null}
            onDone={(s) => markM.mutate(s)}
            onOpen={openStep}
          />

          <PlanMonthItemList
            title={`Tài sản theo kế hoạch tháng ${monthLabel(current.start)}`}
            items={board.items}
            emptyTitle="Tháng này không có tài sản nào theo kế hoạch."
            canUpdate={canUpdate}
            onMove={moveItem}
            onOpen={openItem}
          />

          <PlanMonthItemList
            title={`Xem trước tháng ${monthLabel(board.nextStart)}`}
            items={board.nextItems}
            emptyTitle="Tháng sau chưa có tài sản nào theo kế hoạch."
            canUpdate={canUpdate}
            onMove={moveItem}
            onOpen={openItem}
            readOnly
          />
        </>
      )}

      <MoveForecastDialog target={moving} workspaceId={workspaceId} onOpenChange={() => setMoving(null)} />
    </div>
  );
};

export default OwnerPlanOperationsPage;
