import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Map, Printer, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { HeroFigure } from "@/components/asset-owner-portal/ui/HeroFigure";
import { OwnerFilterBar } from "@/components/asset-owner-portal/ui/OwnerFilterBar";
import { OwnerFilterSelect } from "@/components/asset-owner-portal/ui/OwnerFilterSelect";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { ClosePlanDialog } from "@/components/asset-owner-portal/auction-plan/province/ClosePlanDialog";
import { OpenCycleDialog } from "@/components/asset-owner-portal/auction-plan/province/OpenCycleDialog";
import { ProvinceAttentionCards } from "@/components/asset-owner-portal/auction-plan/province/ProvinceAttentionCards";
import { ProvinceCommuneTable } from "@/components/asset-owner-portal/auction-plan/province/ProvinceCommuneTable";
import { ProvinceCycleList } from "@/components/asset-owner-portal/auction-plan/province/ProvinceCycleList";
import { ProvinceStats } from "@/components/asset-owner-portal/auction-plan/province/ProvinceStats";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { usePlanCanApprove } from "@/hooks/useAuctionPlanApproval";
import {
  useAllPlanCycles,
  useAuctionPlanProvinceOk,
  useConsolidatedPlanItems,
  useProvinceBoard,
} from "@/hooks/useAuctionPlanProvince";
import { downloadProvincePlanXlsx } from "@/lib/auctionPlan/provinceExcel";
import { ownerPlanCycleHref, ownerPlanHref, ownerPlanProvincePrintHref } from "@/lib/auctionPlan/routes";
import {
  defaultSortDir,
  sortProvinceRows,
  type ProvinceRollupRow,
  type ProvinceSortKey,
} from "@/lib/auctionPlan/province";
import {
  defaultPlanPeriod,
  parsePlanPeriodKey,
  planPeriodKey,
  planPeriodLabel,
  planPeriodOptions,
} from "@/lib/auctionPlan/period";
import { formatMoneyShort, moneyShortParts } from "@/utils/money";

const YEAR_SPAN = 4;

/**
 * "Toàn tỉnh" — /chu-tai-san/ke-hoach/toan-tinh (§A6).
 *
 * L1 câu trả lời của năm · L2 việc cần theo dõi (đơn vị chưa trình, bị trả lại,
 * chờ xem xét, có tài sản trễ) · L3 bốn ô chỉ số + bảng từng đơn vị sắp xếp được
 * · L4 xuất Excel / in bản tổng hợp.
 *
 * MÀN CỦA CẤP TỈNH: server quyết ai mở được (`auction_plan_province_ok`) — cán bộ
 * bị giới hạn chi nhánh thấy thông báo "ngoài phạm vi", không thấy bảng rỗng.
 * Mọi con số đọc từ `auction_plan_rollup`, hàm này cộng chính các dòng
 * `auction_plan_period_metrics` của từng kế hoạch nên tổng của tỉnh luôn bằng
 * tổng các số "Theo kỳ" của từng xã.
 */
const OwnerPlanProvincePage = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const { workspaceId, isLoading: wsLoading } = useOwnerWorkspace();

  const [filters, setFilter] = useUrlFilterState({ nam: String(currentYear), ky: "" });
  const planYear = Number(filters.nam) || currentYear;
  const periodOptions = useMemo(() => planPeriodOptions(planYear), [planYear]);
  const period = useMemo(
    () =>
      (filters.ky ? parsePlanPeriodKey(filters.ky) : null) ??
      defaultPlanPeriod(planYear, new Date().toISOString().slice(0, 10)),
    [filters.ky, planYear],
  );

  const { data: provinceOk, isLoading: okLoading } = useAuctionPlanProvinceOk(workspaceId);
  const { data: canApprove = false } = usePlanCanApprove(workspaceId);
  const enabled = provinceOk === true;
  const board = useProvinceBoard(workspaceId, planYear, period, enabled);
  const cycles = useAllPlanCycles(workspaceId, enabled);
  const consolidated = useConsolidatedPlanItems(workspaceId, planYear, enabled);

  const [sortKey, setSortKey] = useState<ProvinceSortKey>("unit");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [creatingCycle, setCreatingCycle] = useState(false);
  const [closing, setClosing] = useState<ProvinceRollupRow | null>(null);

  const sorted = useMemo(() => sortProvinceRows(board.rows, sortKey, sortDir), [board.rows, sortKey, sortDir]);
  const years = useMemo(
    () => Array.from({ length: YEAR_SPAN }, (_, i) => currentYear + 1 - i),
    [currentYear],
  );
  const cyclesOfYear = useMemo(
    () => cycles.cycles.filter((c) => c.plan_year === planYear),
    [cycles.cycles, planYear],
  );

  const onSort = (key: ProvinceSortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(defaultSortDir(key));
    }
  };

  if (wsLoading || okLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <OwnerNoWorkspaceState icon={Map}>
        <EmptyState
          icon={Map}
          title="Chưa có không gian làm việc"
          description="Bảng tổng hợp toàn tỉnh dành cho đơn vị cấp tỉnh đã xác thực."
          action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Xác thực tổ chức</Button>}
        />
      </OwnerNoWorkspaceState>
    );
  }

  if (!provinceOk) {
    return (
      <div className="space-y-6">
        <OwnerPageHeader
          title="Toàn tỉnh"
          subtitle="Tổng hợp kế hoạch đấu giá của mọi xã, phường trong tỉnh"
        />
        <EmptyState
          icon={ShieldAlert}
          tone="warning"
          title="Bảng này ngoài phạm vi của bạn."
          description="Chỉ cấp tỉnh — người có quyền Duyệt kế hoạch, hoặc thành viên không bị giới hạn chi nhánh — mở được bảng toàn tỉnh. Kế hoạch của đơn vị bạn nằm ở mục Kế hoạch đấu giá."
          action={<Button onClick={() => navigate("/chu-tai-san/ke-hoach")}>Về kế hoạch của đơn vị</Button>}
        />
      </div>
    );
  }

  const { summary, attention, today } = board;
  const planned = moneyShortParts(summary.plannedStartValue);

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Toàn tỉnh"
        subtitle="Đơn vị nào đã trình, kế hoạch so thực tế theo kỳ, và đơn vị nào đang trễ"
        actions={
          canApprove ? (
            <Button onClick={() => setCreatingCycle(true)}>Mở đợt lập kế hoạch</Button>
          ) : undefined
        }
      />

      <OwnerFilterBar>
        <OwnerFilterSelect label="Năm" value={String(planYear)} onValueChange={(v) => setFilter("nam", v)}>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </OwnerFilterSelect>
        <OwnerFilterSelect
          label="Kỳ"
          value={planPeriodKey(period)}
          onValueChange={(v) => setFilter("ky", v)}
        >
          {periodOptions.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              {o.label}
            </SelectItem>
          ))}
        </OwnerFilterSelect>
      </OwnerFilterBar>

      {board.isError ? (
        <EmptyState icon={Map} tone="destructive" title="Chưa tải được bảng tổng hợp toàn tỉnh." />
      ) : board.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <HeroFigure
            label={`Năm ${planYear}`}
            value={`${summary.submittedCount}/${summary.submittedOf}`}
            unit="đơn vị đã trình kế hoạch"
            progress={summary.submittedOf > 0 ? (summary.submittedCount * 100) / summary.submittedOf : 0}
            context={
              <span>
                {`${summary.plannedCount} tài sản theo kế hoạch ${planPeriodLabel(period)} · giá trị khởi điểm dự kiến ${planned.value} ${planned.unit}`}
                {summary.assignedRevenue > 0
                  ? ` · đã thu ${formatMoneyShort(summary.collected)} / ${formatMoneyShort(summary.assignedRevenue)} chỉ tiêu giao`
                  : ` · đã thu ${formatMoneyShort(summary.collected)}`}
              </span>
            }
          />

          <ProvinceAttentionCards
            attention={attention}
            today={today}
            onOpenPlan={(planId) => navigate(ownerPlanHref(planId))}
          />

          <ProvinceStats summary={summary} periodLabel={planPeriodLabel(period)} />

          <SectionCard
            title={`Từng đơn vị · ${planPeriodLabel(period)}`}
            icon={Map}
            count={summary.unitCount}
            actions={
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={consolidated.units.length === 0}
                  onClick={() =>
                    downloadProvincePlanXlsx(consolidated.units, consolidated.rows, planYear)
                  }
                >
                  <Download aria-hidden="true" />
                  Xuất Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(ownerPlanProvincePrintHref(planYear))}
                >
                  <Printer aria-hidden="true" />
                  In tổng hợp
                </Button>
              </>
            }
          >
            <ProvinceCommuneTable
              rows={sorted}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              onOpenPlan={(planId) => navigate(ownerPlanHref(planId))}
              canClose={canApprove}
              onClosePlan={setClosing}
            />
          </SectionCard>

          <ProvinceCycleList
            cycles={cyclesOfYear}
            units={cycles.units}
            today={today}
            canApprove={canApprove}
            onOpenCycle={(cycleId) => navigate(ownerPlanCycleHref(cycleId))}
            onCreate={() => setCreatingCycle(true)}
          />
        </>
      )}

      <OpenCycleDialog
        open={creatingCycle}
        onOpenChange={setCreatingCycle}
        workspaceId={workspaceId}
        defaultYear={planYear}
        onOpened={(cycleId) => navigate(ownerPlanCycleHref(cycleId))}
      />
      <ClosePlanDialog row={closing} workspaceId={workspaceId} onOpenChange={() => setClosing(null)} />
    </div>
  );
};

export default OwnerPlanProvincePage;
