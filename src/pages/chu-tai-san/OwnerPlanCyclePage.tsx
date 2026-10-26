import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, Map as MapIcon, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { HeroFigure } from "@/components/asset-owner-portal/ui/HeroFigure";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { CycleBoardTable } from "@/components/asset-owner-portal/auction-plan/province/CycleBoardTable";
import { CycleUnitsEditor } from "@/components/asset-owner-portal/auction-plan/province/CycleUnitsEditor";
import { buildCycleDraft, type CycleUnitDraftMap } from "@/components/asset-owner-portal/auction-plan/province/cycleDraft";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { usePlanCanApprove } from "@/hooks/useAuctionPlanApproval";
import {
  useAllPlanCycles,
  useAuctionPlanProvinceOk,
  useClosePlanCycle,
  usePlanCycleBoard,
  usePlanCycleCandidates,
  useSetPlanCycleUnits,
  type CycleUnitInput,
} from "@/hooks/useAuctionPlanProvince";
import { daysToDeadline, deadlineText } from "@/lib/auctionPlan/cycles";
import { formatPlanDate } from "@/lib/auctionPlan/print";
import { planHealthToday } from "@/lib/auctionPlan/health";
import { ownerPlanHref, ownerPlanProvinceHref } from "@/lib/auctionPlan/routes";
import {
  AUCTION_PLAN_CYCLE_STATUS_LABELS,
  AUCTION_PLAN_KIND_LABELS,
} from "@/lib/auctionPlan/types";
import { formatMoneyShort } from "@/utils/money";

const SUBMITTED: readonly string[] = ["submitted", "approved", "adjusting", "closed"];

/**
 * Chi tiết một đợt lập kế hoạch — /chu-tai-san/ke-hoach/dot/:cycleId (§A6).
 *
 * L1 bao nhiêu đơn vị đã trình · L2/L3 bảng theo dõi từng đơn vị · khối giao lại
 * chỉ tiêu (chỉ khi đợt còn MỞ và người xem có quyền duyệt).
 *
 * `auction_plan_cycle_set_units` THAY TOÀN BỘ danh sách đơn vị trong một giao
 * dịch, nên khối chỉnh sửa luôn gửi lại cả danh sách đang chọn — bỏ tích một xã
 * nghĩa là xoá xã đó khỏi đợt.
 */
const OwnerPlanCyclePage = () => {
  const { cycleId } = useParams<{ cycleId: string }>();
  const navigate = useNavigate();
  const { workspaceId, isLoading: wsLoading } = useOwnerWorkspace();
  const today = useMemo(() => planHealthToday(), []);

  const { data: provinceOk, isLoading: okLoading } = useAuctionPlanProvinceOk(workspaceId);
  const { data: canApprove = false } = usePlanCanApprove(workspaceId);
  const enabled = provinceOk === true;
  const { cycles, units, isLoading: cyclesLoading } = useAllPlanCycles(workspaceId, enabled);
  const boardQuery = usePlanCycleBoard(enabled ? cycleId : undefined);
  const candidatesQuery = usePlanCycleCandidates(workspaceId, enabled && canApprove);

  const cycle = useMemo(() => cycles.find((c) => c.id === cycleId) ?? null, [cycles, cycleId]);
  const rows = useMemo(() => boardQuery.data ?? [], [boardQuery.data]);
  const candidates = useMemo(() => candidatesQuery.data ?? [], [candidatesQuery.data]);

  const setUnits = useSetPlanCycleUnits(workspaceId);
  const closeCycle = useClosePlanCycle(workspaceId);
  const [draft, setDraft] = useState<CycleUnitDraftMap>({});

  // Bản soạn dựng từ danh sách ĐANG GIAO của đợt — mở trang là thấy đúng cái đang có.
  useEffect(() => {
    if (candidates.length === 0) return;
    const existing = new Map(
      units
        .filter((u) => u.cycle_id === cycleId)
        .map((u) => [u.admin_unit_code, { revenue: u.assigned_revenue, count: u.assigned_count }]),
    );
    setDraft(buildCycleDraft(candidates, existing));
  }, [candidates, units, cycleId]);

  if (wsLoading || okLoading || (enabled && cyclesLoading)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!provinceOk) {
    return (
      <div className="space-y-6">
        <OwnerPageHeader title="Đợt lập kế hoạch" subtitle="Hạn trình và chỉ tiêu tỉnh giao cho từng xã, phường" />
        <EmptyState
          icon={ShieldAlert}
          tone="warning"
          title="Trang này ngoài phạm vi của bạn."
          description="Chỉ cấp tỉnh mở được trang đợt lập kế hoạch. Kế hoạch của đơn vị bạn nằm ở mục Kế hoạch đấu giá."
          action={<Button onClick={() => navigate("/chu-tai-san/ke-hoach")}>Về kế hoạch của đơn vị</Button>}
        />
      </div>
    );
  }

  if (!cycle) {
    return (
      <div className="space-y-6">
        <OwnerPageHeader title="Đợt lập kế hoạch" />
        <EmptyState
          icon={CalendarClock}
          title="Không tìm thấy đợt lập kế hoạch này."
          action={<Button onClick={() => navigate(ownerPlanProvinceHref())}>Về Toàn tỉnh</Button>}
        />
      </div>
    );
  }

  const submitted = rows.filter((r) => SUBMITTED.includes(r.plan_status ?? "")).length;
  const assigned = rows.reduce((t, r) => t + Number(r.assigned_revenue ?? 0), 0);
  const days = cycle.status === "open" ? daysToDeadline(cycle.submit_deadline, today) : null;

  const saveUnits = () => {
    const payload: CycleUnitInput[] = candidates
      .filter((c) => draft[c.admin_unit_code]?.selected)
      .map((c) => ({
        admin_unit_code: c.admin_unit_code,
        branch_id: c.shape === "branch" ? c.branch_id : null,
        child_workspace_id: c.shape === "child" ? c.child_workspace_id : null,
        assigned_revenue: draft[c.admin_unit_code]?.revenue ?? null,
        assigned_count: draft[c.admin_unit_code]?.count ?? null,
      }));
    setUnits.mutate({ cycleId: cycle.id, units: payload });
  };

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 gap-1 text-muted-foreground"
        onClick={() => navigate(ownerPlanProvinceHref(cycle.plan_year))}
      >
        <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
        Về Toàn tỉnh
      </Button>

      <OwnerPageHeader
        title={`${AUCTION_PLAN_KIND_LABELS[cycle.kind]} ${cycle.plan_year}`}
        subtitle={`Đợt lập kế hoạch · ${AUCTION_PLAN_CYCLE_STATUS_LABELS[cycle.status]}${
          cycle.submit_deadline ? ` · hạn trình ${formatPlanDate(cycle.submit_deadline)}` : ""
        }`}
        actions={
          canApprove && cycle.status === "open" ? (
            <Button
              variant="outline"
              onClick={() => closeCycle.mutate(cycle.id)}
              disabled={closeCycle.isPending}
            >
              {closeCycle.isPending ? "Đang đóng…" : "Đóng đợt"}
            </Button>
          ) : undefined
        }
      />

      <HeroFigure
        label={`Đợt ${AUCTION_PLAN_KIND_LABELS[cycle.kind].toLowerCase()} ${cycle.plan_year}`}
        value={`${submitted}/${rows.length}`}
        unit="đơn vị đã trình"
        progress={rows.length > 0 ? (submitted * 100) / rows.length : 0}
        context={
          <span>
            {assigned > 0 ? `Chỉ tiêu thu giao ${formatMoneyShort(assigned)}` : "Chưa giao chỉ tiêu thu"}
            {deadlineText(days) ? ` · ${deadlineText(days)}` : ""}
          </span>
        }
      />

      {cycle.instructions && (
        <SectionCard title="Hướng dẫn gửi các đơn vị" icon={CalendarClock}>
          <p className="whitespace-pre-line text-sm text-foreground">{cycle.instructions}</p>
        </SectionCard>
      )}

      <SectionCard title="Theo dõi từng đơn vị" icon={MapIcon} count={rows.length}>
        {boardQuery.isError ? (
          <EmptyState icon={MapIcon} tone="destructive" compact title="Chưa tải được bảng theo dõi của đợt." />
        ) : boardQuery.isLoading ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : (
          <CycleBoardTable rows={rows} onOpenPlan={(planId) => navigate(ownerPlanHref(planId))} />
        )}
      </SectionCard>

      {canApprove && cycle.status === "open" && (
        <SectionCard title="Giao đơn vị & chỉ tiêu" icon={CalendarClock} tone="warning">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Lưu sẽ THAY toàn bộ danh sách đơn vị của đợt: bỏ tích một đơn vị là xoá đơn vị đó khỏi đợt (kế
              hoạch đơn vị đã lập không bị xoá).
            </p>
            <CycleUnitsEditor
              candidates={candidates}
              draft={draft}
              onChange={setDraft}
              disabled={setUnits.isPending}
            />
            <div className="flex justify-end">
              <Button onClick={saveUnits} disabled={setUnits.isPending}>
                {setUnits.isPending ? "Đang lưu…" : "Lưu danh sách & chỉ tiêu"}
              </Button>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
};

export default OwnerPlanCyclePage;
