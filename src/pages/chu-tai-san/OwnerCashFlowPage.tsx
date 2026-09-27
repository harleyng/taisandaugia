import { useMemo } from "react";
import { Building2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { CashPeriodSelect, CashScopeSelect } from "@/components/asset-owner-portal/cash-flow/CashFlowFilters";
import { CashReportHero } from "@/components/asset-owner-portal/cash-flow/CashReportHero";
import { CashRecoveryBars } from "@/components/asset-owner-portal/cash-flow/CashRecoveryBars";
import { CashFlowInfoNotes } from "@/components/asset-owner-portal/cash-flow/CashFlowInfoNotes";
import { UnitRecoveryTable } from "@/components/asset-owner-portal/cash-flow/UnitRecoveryTable";
import { CashForecastCard } from "@/components/asset-owner-portal/cash-flow/CashForecastCard";
import {
  CashFlowLoadError,
  CashFlowNoWorkspace,
  CashFlowSkeleton,
} from "@/components/asset-owner-portal/cash-flow/CashFlowPageStates";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useCashCanWrite, useOwnerCashFlow } from "@/hooks/useOwnerCashFlow";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { SCOPE_ALL, buildCashReportView, resolveScope, scopeData, untrackedSoldOf } from "@/lib/ownerCashFlow";
import { downloadCashFlowXlsx } from "@/lib/ownerCashFlowExcel";
import { DEFAULT_OWNER_PERIOD, ownerPeriodGroups, ownerPeriodIds } from "@/lib/ownerPeriods";
import { todayIso } from "@/lib/ownerOutcomeReport";

const DEFAULTS = { period: DEFAULT_OWNER_PERIOD, scope: SCOPE_ALL };

/**
 * "Dòng tiền" — /chu-tai-san/dong-tien (nhóm Phân tích; phần thao tác đã tách sang "Thu tiền"
 * /chu-tai-san/thu-tien ngày 2026-09-27). Báo cáo THEO KỲ: hero, thác tiền và bảng đơn vị cùng
 * tính các tài sản bán trong kỳ ⇒ Đã thu + Còn phải thu = Giá trúng. Dự báo tiền về tính từ hôm nay.
 */
const OwnerCashFlowPage = () => {
  const { workspaceId, workspace, isLoading: wsLoading } = useOwnerWorkspace();
  const { data, isLoading, isError, refetch } = useOwnerCashFlow(workspaceId);
  const canWrite = useCashCanWrite(data);

  const today = useMemo(() => todayIso(), []);
  const periodGroups = useMemo(() => ownerPeriodGroups(today), [today]);
  const [f, , setFilters] = useUrlFilterState(DEFAULTS, { period: ownerPeriodIds(today) });

  const scope = data ? resolveScope(f.scope, data.units) : SCOPE_ALL;
  const scoped = useMemo(() => (data ? scopeData(data, scope) : null), [data, scope]);
  const view = useMemo(() => (scoped ? buildCashReportView(scoped, f.period) : null), [scoped, f.period]);

  const selfId = data?.units.find((u) => u.isSelf)?.id ?? null;
  const canReport =
    !!scoped && !!view && untrackedSoldOf(scoped.rows, selfId, view.range).some((r) => canWrite(r.unitId, r.branchId));
  const multiUnit = (scoped?.units.length ?? 0) > 1;

  const exportXlsx = () => {
    if (!scoped || !view) return;
    const scopeName = multiUnit ? "Toàn hệ thống" : (scoped.units[0]?.name ?? "");
    downloadCashFlowXlsx(scoped, view, { periodId: f.period, scopeName }, `dong-tien-${f.period}.xlsx`);
  };

  if (wsLoading || (workspaceId && isLoading)) return <CashFlowSkeleton />;
  if (!workspaceId || !workspace) return <CashFlowNoWorkspace feature="Dòng tiền" />;

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Dòng tiền"
        subtitle="Báo cáo theo kỳ — tài sản bán trong kỳ, số đã thu tính tới hôm nay"
        actions={
          <>
            {data && <CashScopeSelect scope={scope} units={data.units} onChange={(s) => setFilters({ scope: s })} />}
            <CashPeriodSelect period={f.period} groups={periodGroups} onChange={(p) => setFilters({ period: p })} />
            <Button variant="outline" className="gap-1.5" disabled={!view} onClick={exportXlsx}>
              <Download className="h-4 w-4" strokeWidth={1.5} />
              Xuất Excel
            </Button>
          </>
        }
      />

      {isError || !data || !view ? (
        <CashFlowLoadError onRetry={() => void refetch()} />
      ) : (
        <>
          <CashReportHero totals={view.waterfall} rate={view.rate} periodId={f.period} />

          <CashRecoveryBars totals={view.waterfall} steps={view.steps} />

          <CashFlowInfoNotes notes={view.waterfall.notes} canReport={canReport} />

          {multiUnit && (
            <SectionCard title="Theo đơn vị" icon={Building2} count={view.units.length}>
              <UnitRecoveryTable units={view.units} />
            </SectionCard>
          )}

          <CashForecastCard forecast={view.forecast} estimate={view.estimate} />
        </>
      )}
    </div>
  );
};

export default OwnerCashFlowPage;
