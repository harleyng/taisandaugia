import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarRange, FileBarChart, KanbanSquare, ListChecks, Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerTabsList, OwnerTabsTrigger } from "@/components/asset-owner-portal/ui/OwnerTabs";
import { PlanApprovalTab } from "@/components/asset-owner-portal/auction-plan/approval/PlanApprovalTab";
import { PlanCrumb } from "@/components/asset-owner-portal/auction-plan/PlanCrumb";
import { PlanDetailHeader } from "@/components/asset-owner-portal/auction-plan/editor/PlanDetailHeader";
import { PlanItemsTab } from "@/components/asset-owner-portal/auction-plan/editor/PlanItemsTab";
import { PlanPeriodTab } from "@/components/asset-owner-portal/auction-plan/period/PlanPeriodTab";
import { PlanProgressTab } from "@/components/asset-owner-portal/auction-plan/progress/PlanProgressTab";
import { SubmitPlanDialog } from "@/components/asset-owner-portal/auction-plan/editor/SubmitPlanDialog";
import { useAuctionPlanDetail, useReopenPlan } from "@/hooks/useAuctionPlan";
import { useAdminUnit, useAdminUnits } from "@/hooks/useAdminUnits";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { useWorkspaceBranches } from "@/hooks/useWorkspaceBranches";
import { adminUnitFullLabel } from "@/lib/adminUnits";
import { OWNER_PLANS_HREF, PLAN_TABS, PLAN_TAB_LABELS, type PlanTab } from "@/lib/auctionPlan/routes";
import { planItemTotals } from "@/lib/auctionPlan/totals";

const TAB_ICONS: Record<PlanTab, typeof KanbanSquare> = {
  "danh-muc": KanbanSquare,
  "tien-do": ListChecks,
  "theo-ky": FileBarChart,
  "phe-duyet": Stamp,
};

/**
 * Chi tiết một kế hoạch đấu giá — /chu-tai-san/ke-hoach/:id (A6).
 *
 * ⚠️ CẤU TRÚC CHO CÁC PHA SAU: trang chỉ lo tải dữ liệu, chặn cửa và dựng khung
 * tab. Mỗi tab là MỘT component trong `auction-plan/` và mỗi pha chỉ sửa đúng
 * một dòng `<TabsContent>` nên các pha không đạp lên nhau (Phase 4
 * "phe-duyet", Phase 5 "tien-do", Phase 6 "theo-ky" — từ đây cả bốn tab đã có
 * thật). Quyền xét theo chi nhánh CỦA KẾ HOẠCH (useAuctionPlanDetail).
 */
const OwnerAuctionPlanDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [filters, setFilter] = useUrlFilterState({ tab: PLAN_TABS[0] }, { tab: PLAN_TABS });
  const tab = filters.tab as PlanTab;
  const [submitting, setSubmitting] = useState(false);

  const {
    plan,
    items,
    canEditBaseline,
    canCreateItem,
    canDelete,
    canFinalize,
    canReopen,
    canUpdateExec,
    canCreateTarget,
    baselineOpen,
    isLoading,
    itemsLoading,
    isError,
    refetch,
  } = useAuctionPlanDetail(id);
  const reopenM = useReopenPlan(plan);
  const { branches } = useWorkspaceBranches(plan?.workspace_id ?? null);
  const { data: adminUnit } = useAdminUnit(plan?.admin_unit_code);
  const { data: provinces } = useAdminUnits(null);

  const totals = useMemo(() => planItemTotals(items), [items]);
  const unitLabel = useMemo(() => {
    if (!plan?.branch_id) return "Toàn đơn vị";
    const branch = branches.find((b) => b.id === plan.branch_id);
    return branch?.display_name || branch?.asset_owner_name || "Chi nhánh";
  }, [plan?.branch_id, branches]);
  const adminUnitLabel = useMemo(() => {
    if (!adminUnit) return null;
    const province = provinces?.find((p) => p.code === adminUnit.parent_code) ?? null;
    return adminUnitFullLabel(adminUnit, province);
  }, [adminUnit, provinces]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-80" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[108px] rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !plan) {
    return (
      <div className="space-y-5">
        <PlanCrumb />
        <EmptyState
          icon={CalendarRange}
          tone={isError ? "destructive" : "muted"}
          title={isError ? "Chưa tải được kế hoạch." : "Không tìm thấy kế hoạch"}
          description={
            isError
              ? undefined
              : "Kế hoạch có thể đã bị xoá, thuộc đơn vị khác, hoặc ngoài phạm vi chi nhánh của bạn."
          }
          action={
            isError ? (
              <Button variant="outline" onClick={refetch}>
                Thử lại
              </Button>
            ) : (
              <Button onClick={() => navigate(OWNER_PLANS_HREF)}>Về danh sách kế hoạch</Button>
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PlanCrumb trail={[{ label: `Năm ${plan.plan_year}` }]} />

      <PlanDetailHeader
        plan={plan}
        totals={totals}
        unitLabel={unitLabel}
        adminUnitLabel={adminUnitLabel}
        canFinalize={canFinalize}
        canReopen={canReopen}
        reopening={reopenM.isPending}
        onSubmit={() => setSubmitting(true)}
        onReopen={() => reopenM.mutate()}
      />

      <Tabs value={tab} onValueChange={(v) => v && setFilter("tab", v)} className="space-y-5">
        <OwnerTabsList aria-label="Mục của kế hoạch">
          {PLAN_TABS.map((t) => (
            <OwnerTabsTrigger
              key={t}
              value={t}
              icon={TAB_ICONS[t]}
              count={t === "danh-muc" ? items.length : undefined}
            >
              {PLAN_TAB_LABELS[t]}
            </OwnerTabsTrigger>
          ))}
        </OwnerTabsList>

        <TabsContent value="danh-muc" className="mt-0">
          <PlanItemsTab
            plan={plan}
            items={items}
            isLoading={itemsLoading}
            canEdit={canEditBaseline}
            canCreate={canCreateItem}
            canDelete={canDelete}
          />
        </TabsContent>
        <TabsContent value="tien-do" className="mt-0">
          <PlanProgressTab
            plan={plan}
            items={items}
            isLoading={itemsLoading}
            canUpdate={canUpdateExec}
            baselineOpen={baselineOpen}
          />
        </TabsContent>
        <TabsContent value="theo-ky" className="mt-0">
          <PlanPeriodTab
            plan={plan}
            items={items}
            isLoading={itemsLoading}
            canCreateTarget={canCreateTarget}
          />
        </TabsContent>
        <TabsContent value="phe-duyet" className="mt-0">
          <PlanApprovalTab plan={plan} canFinalize={canFinalize} />
        </TabsContent>
      </Tabs>

      <SubmitPlanDialog open={submitting} onOpenChange={setSubmitting} plan={plan} totals={totals} />
    </div>
  );
};

export default OwnerAuctionPlanDetailPage;
