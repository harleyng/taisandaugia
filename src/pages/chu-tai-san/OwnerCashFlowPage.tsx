import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, HandCoins, Plus, ReceiptText, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { CashFlowFilters } from "@/components/asset-owner-portal/cash-flow/CashFlowFilters";
import { CashFlowHero } from "@/components/asset-owner-portal/cash-flow/CashFlowHero";
import { OverdueReceivablesBlock } from "@/components/asset-owner-portal/cash-flow/OverdueReceivablesBlock";
import { CashFlowStatGrid } from "@/components/asset-owner-portal/cash-flow/CashFlowStatGrid";
import { CashWaterfallCard } from "@/components/asset-owner-portal/cash-flow/CashWaterfallCard";
import { CashForecastCard } from "@/components/asset-owner-portal/cash-flow/CashForecastCard";
import { CashFlowInfoNotes } from "@/components/asset-owner-portal/cash-flow/CashFlowInfoNotes";
import { ReceivablesTable } from "@/components/asset-owner-portal/cash-flow/ReceivablesTable";
import { CashLedgerTable } from "@/components/asset-owner-portal/cash-flow/CashLedgerTable";
import { UnitBreakdownTable } from "@/components/asset-owner-portal/cash-flow/UnitBreakdownTable";
import { CashFlowDialogs } from "@/components/asset-owner-portal/cash-flow/CashFlowDialogs";
import type { CashDialogState } from "@/components/asset-owner-portal/cash-flow/cashFlowDialogState";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerCashFlow } from "@/hooks/useOwnerCashFlow";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import {
  SCOPE_ALL,
  buildCashFlowView,
  recordableRows,
  resolveScope,
  scopeData,
  untrackedSoldOf,
} from "@/lib/ownerCashFlow";
import { DEFAULT_OWNER_PERIOD, inPeriod, ownerPeriodGroups, ownerPeriodIds } from "@/lib/ownerPeriods";
import { todayIso } from "@/lib/ownerOutcomeReport";

const DEFAULTS = { period: DEFAULT_OWNER_PERIOD, scope: SCOPE_ALL };

/**
 * "Dòng tiền" — /chu-tai-san/dong-tien (docs/owner-control-tower-plan.md Phase 15a).
 * Sổ thu chi của các kết quả phiên đơn vị tự khai; trụ sở đã liên kết chi nhánh ("Tháp
 * Điều Hành") xem gộp toàn hệ thống, chỉ đọc số của chi nhánh.
 * L1 thực nhận trong kỳ → L2 quá hạn → L3 ô số + thác tiền + dự báo → L4 bảng.
 */
const OwnerCashFlowPage = () => {
  const navigate = useNavigate();
  const { workspaceId, workspace, canWriteClaim, isLoading: wsLoading } = useOwnerWorkspace();
  const { data, isLoading, isError, refetch } = useOwnerCashFlow(workspaceId);

  const today = useMemo(() => todayIso(), []);
  const periodGroups = useMemo(() => ownerPeriodGroups(today), [today]);
  const [f, , setFilters] = useUrlFilterState(DEFAULTS, { period: ownerPeriodIds(today) });

  const scope = data ? resolveScope(f.scope, data.units) : SCOPE_ALL;
  const scoped = useMemo(() => (data ? scopeData(data, scope) : null), [data, scope]);
  const view = useMemo(() => (scoped ? buildCashFlowView(scoped, f.period) : null), [scoped, f.period]);
  const ledger = useMemo(
    () => (scoped && view ? scoped.events.filter((e) => inPeriod(e.occurredOn, view.range)) : []),
    [scoped, view],
  );
  // Tên đơn vị chỉ cần khi đang xem gộp nhiều đơn vị.
  const unitNames = useMemo(
    () => (scoped && scoped.units.length > 1 ? new Map(scoped.units.map((u) => [u.id, u.name])) : null),
    [scoped],
  );

  const selfId = data?.units.find((u) => u.isSelf)?.id ?? null;
  const canWrite = useCallback(
    (unitId: string, branchId: string | null) => unitId === selfId && canWriteClaim(branchId),
    [selfId, canWriteClaim],
  );
  const canRecord = !!data && recordableRows(data).some((r) => canWrite(r.unitId, r.branchId));
  const canReport =
    !!scoped && !!view && untrackedSoldOf(scoped.rows, selfId, view.range).some((r) => canWrite(r.unitId, r.branchId));
  const [dialog, setDialog] = useState<CashDialogState | null>(null);

  if (wsLoading || (workspaceId && isLoading)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workspaceId || !workspace) {
    return (
      <OwnerNoWorkspaceState icon={Wallet}>
        <EmptyState
          icon={Wallet}
          title="Chưa có không gian làm việc"
          description="Dòng tiền dành cho chủ tài sản là tổ chức đã xác thực, hoặc người được một đơn vị mời vào."
          action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Xác thực tổ chức</Button>}
        />
      </OwnerNoWorkspaceState>
    );
  }

  const system = (data?.units.length ?? 0) > 1;

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Dòng tiền"
        subtitle={
          system
            ? "Tiền về, phí và dự báo của trụ sở cùng các chi nhánh đã liên kết"
            : "Tiền về, phí và dự báo của các tài sản đơn vị tự theo dõi"
        }
        actions={
          canRecord && (
            <Button className="gap-1.5" onClick={() => setDialog({ kind: "record", outcomeId: null })}>
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Ghi thu chi
            </Button>
          )
        }
      />

      {isError || !data || !scoped || !view ? (
        <EmptyState
          icon={Wallet}
          tone="destructive"
          title="Chưa tải được dòng tiền."
          action={
            <Button variant="outline" onClick={() => void refetch()}>
              Thử lại
            </Button>
          }
        />
      ) : (
        <>
          <CashFlowFilters
            period={f.period}
            scope={scope}
            periodGroups={periodGroups}
            units={data.units}
            onChange={(patch) => setFilters(patch)}
          />

          <CashFlowHero totals={view.period} periodId={f.period} />

          <OverdueReceivablesBlock items={view.overdue} unitNames={unitNames} canWrite={canWrite} onAction={setDialog} />

          <CashFlowStatGrid view={view} />

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <CashWaterfallCard totals={view.waterfall} steps={view.steps} />
            </div>
            <div className="lg:col-span-5">
              <CashForecastCard forecast={view.forecast} estimate={view.estimate} />
            </div>
          </div>

          <CashFlowInfoNotes notes={view.waterfall.notes} canReport={canReport} />

          {unitNames && (
            <SectionCard title="Theo đơn vị" icon={Building2} count={view.units.length}>
              <UnitBreakdownTable units={view.units} />
            </SectionCard>
          )}

          <SectionCard title="Khoản phải thu" icon={HandCoins} count={view.receivables.length}>
            {view.receivables.length ? (
              <ReceivablesTable items={view.receivables} unitNames={unitNames} canWrite={canWrite} onAction={setDialog} />
            ) : (
              <EmptyState compact icon={HandCoins} tone="success" title="Không còn khoản nào phải thu — tốt lắm." />
            )}
          </SectionCard>

          <SectionCard title="Sổ thu chi trong kỳ" icon={ReceiptText} count={ledger.length}>
            {ledger.length ? (
              <CashLedgerTable events={ledger} unitNames={unitNames} canWrite={canWrite} onAction={setDialog} />
            ) : (
              <EmptyState
                compact
                icon={ReceiptText}
                title="Chưa có khoản thu chi nào trong kỳ này."
                description="Mỗi lần tiền về hoặc trả phí, ghi một khoản để số đã thu và dự báo luôn đúng."
                action={
                  canRecord ? (
                    <Button variant="outline" size="sm" onClick={() => setDialog({ kind: "record", outcomeId: null })}>
                      Ghi thu chi
                    </Button>
                  ) : undefined
                }
              />
            )}
          </SectionCard>

          <CashFlowDialogs
            workspaceId={workspaceId}
            data={data}
            state={dialog}
            canWrite={canWrite}
            onClose={() => setDialog(null)}
          />
        </>
      )}
    </div>
  );
};

export default OwnerCashFlowPage;
