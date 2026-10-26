import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarRange, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { OwnerFilterBar } from "@/components/asset-owner-portal/ui/OwnerFilterBar";
import { OwnerFilterSelect } from "@/components/asset-owner-portal/ui/OwnerFilterSelect";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ReadOnlyNote } from "@/components/asset-owner-portal/pulse/PulseListParts";
import { CreatePlanDialog } from "@/components/asset-owner-portal/auction-plan/CreatePlanDialog";
import { PlanCard } from "@/components/asset-owner-portal/auction-plan/PlanCard";
import { PlanCycleBanner } from "@/components/asset-owner-portal/auction-plan/PlanCycleBanner";
import { PlanListActions } from "@/components/asset-owner-portal/auction-plan/PlanListActions";
import { PlanPastYears } from "@/components/asset-owner-portal/auction-plan/PlanPastYears";
import { PlanQuarterTiles } from "@/components/asset-owner-portal/auction-plan/PlanQuarterTiles";
import { PlanYearSummary } from "@/components/asset-owner-portal/auction-plan/PlanYearSummary";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { useAuctionPlansBoard } from "@/hooks/useAuctionPlans";
import { planItemTotals, type PlanTotals } from "@/lib/auctionPlan/totals";

const EMPTY_TOTALS: PlanTotals = planItemTotals([]);

/**
 * "Kế hoạch đấu giá" — /chu-tai-san/ke-hoach (A6 "List (commune)").
 *
 * L1 tổng của năm đang chọn · bảng thông báo của đợt lập kế hoạch · L2 việc cần
 * làm · L3 bốn ô quý · danh sách kế hoạch · L4 các năm khác. Nút ghi chỉ hiện
 * với quyền `ke-hoach:create` — RLS mới là cổng thật.
 */
const OwnerAuctionPlansPage = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [filters, , setFilters] = useUrlFilterState({ nam: String(currentYear) });
  const planYear = Number(filters.nam) || currentYear;
  const [creating, setCreating] = useState(false);

  const {
    workspaceId,
    plans,
    plansOfYear,
    years,
    yearItems,
    cycle,
    unitOptions,
    branchLabel,
    canCreate,
    today,
    isLoading,
    itemsLoading,
    isError,
    refetch,
  } = useAuctionPlansBoard(planYear);

  const totalsByPlan = useMemo(() => {
    const map = new Map<string, PlanTotals>();
    for (const plan of plansOfYear) {
      map.set(plan.id, planItemTotals(yearItems.filter((it) => it.plan_id === plan.id)));
    }
    return map;
  }, [plansOfYear, yearItems]);
  const yearTotals = useMemo(() => planItemTotals(yearItems), [yearItems]);
  const totalsOf = (planId: string) => totalsByPlan.get(planId) ?? EMPTY_TOTALS;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[108px] rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <OwnerNoWorkspaceState icon={CalendarRange}>
        <EmptyState
          icon={CalendarRange}
          title="Chưa có không gian làm việc"
          description="Kế hoạch đấu giá dành cho đơn vị đã xác thực, hoặc người được một đơn vị mời vào."
          action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Xác thực tổ chức</Button>}
        />
      </OwnerNoWorkspaceState>
    );
  }

  const yearChoices = [...new Set([...years, planYear])].sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Kế hoạch đấu giá"
        subtitle="Danh mục tài sản đưa ra đấu giá từng năm, trình cấp trên phê duyệt và theo dõi tiến độ"
        actions={
          canCreate ? (
            <Button className="gap-1.5" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Tạo kế hoạch
            </Button>
          ) : (
            <ReadOnlyNote>Bạn chỉ có quyền xem kế hoạch.</ReadOnlyNote>
          )
        }
      />

      {isError ? (
        <EmptyState
          icon={CalendarRange}
          tone="destructive"
          title="Chưa tải được kế hoạch."
          action={
            <Button variant="outline" onClick={refetch}>
              Thử lại
            </Button>
          }
        />
      ) : (
        <>
          <PlanYearSummary planYear={planYear} plans={plansOfYear} totals={yearTotals} loading={itemsLoading} />

          {cycle && <PlanCycleBanner cycle={cycle} today={today} />}

          <PlanListActions
            plans={plansOfYear}
            totalsOf={totalsOf}
            unitLabel={branchLabel}
            cycle={cycle}
            today={today}
          />

          <OwnerFilterBar>
            <OwnerFilterSelect label="Năm" value={String(planYear)} onValueChange={(nam) => setFilters({ nam })}>
              {yearChoices.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </OwnerFilterSelect>
          </OwnerFilterBar>

          <PlanQuarterTiles totals={yearTotals} planYear={planYear} />

          {plansOfYear.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title={`Chưa có kế hoạch năm ${planYear}.`}
              description={
                canCreate
                  ? "Tạo kế hoạch rồi thêm từng lô đất, hoặc nhập cả danh mục từ file Excel đang dùng."
                  : "Đơn vị chưa lập kế hoạch cho năm này."
              }
              action={canCreate ? <Button onClick={() => setCreating(true)}>Tạo kế hoạch</Button> : undefined}
            />
          ) : (
            <div className="space-y-3">
              {plansOfYear.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  totals={totalsOf(plan.id)}
                  unitLabel={branchLabel(plan.branch_id)}
                  loading={itemsLoading}
                />
              ))}
            </div>
          )}

          <PlanPastYears plans={plans} planYear={planYear} onPickYear={(y) => setFilters({ nam: String(y) })} />
        </>
      )}

      {canCreate && workspaceId && (
        <CreatePlanDialog
          open={creating}
          onOpenChange={setCreating}
          workspaceId={workspaceId}
          plans={plans}
          unitOptions={unitOptions}
          cycle={cycle}
          planYear={planYear}
        />
      )}
    </div>
  );
};

export default OwnerAuctionPlansPage;
