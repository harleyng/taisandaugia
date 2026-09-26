import { useMemo, useState } from "react";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, Gavel, Plus, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ReportOutcomeDialog } from "@/components/asset-owner-portal/outcomes/ReportOutcomeDialog";
import { OutcomeConflictCards } from "@/components/asset-owner-portal/outcomes-page/OutcomeConflictCards";
import { OutcomeConflictSheet } from "@/components/asset-owner-portal/outcomes-page/OutcomeConflictSheet";
import { OutcomeFilters, type OutcomeFilterValues } from "@/components/asset-owner-portal/outcomes-page/OutcomeFilters";
import { OutcomeHero, OutcomeStatGrid } from "@/components/asset-owner-portal/outcomes-page/OutcomeTotals";
import { OutcomeImportDialog } from "@/components/asset-owner-portal/outcomes-page/OutcomeImportDialog";
import { OutcomesTable } from "@/components/asset-owner-portal/outcomes-page/OutcomesTable";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerOutcomesOverview } from "@/hooks/useOwnerOutcomesOverview";
import { useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { OUTCOME_CONFIDENCES } from "@/lib/ownerOutcomes";
import {
  BRANCH_ALL,
  OUTCOME_FILTERS,
  filterOverview,
  sortOverview,
  summarizeOutcomes,
  type OutcomeFilter,
} from "@/lib/ownerOutcomesOverview";
import { DEFAULT_OWNER_PERIOD, ownerPeriodGroups, ownerPeriodIds } from "@/lib/ownerPeriods";
import { todayIso, type OutcomeDialogTarget } from "@/lib/ownerOutcomeReport";
import type { OwnerOutcomeRecord } from "@/lib/ownerOutcomeEdit";

const DEFAULTS: OutcomeFilterValues = {
  period: DEFAULT_OWNER_PERIOD,
  branch: BRANCH_ALL,
  outcome: "all",
  source: "all",
  lech: "0",
  q: "",
};

interface DialogState {
  target: OutcomeDialogTarget;
  record: OwnerOutcomeRecord | null;
}

/**
 * "Kết quả phiên" — /chu-tai-san/ket-qua (docs/owner-control-tower-plan.md Phase 8).
 * Mỗi tài sản có kết quả một dòng, trên sàn lẫn ngoài sàn; gộp nguồn ở server
 * (RPC owner_outcomes_overview). L1 tổng đã bán → L2 số liệu lệch → L3 theo nhóm → L4 bảng.
 */
const OwnerOutcomesPage = () => {
  const navigate = useNavigate();
  const { workspaceId, workspace, role, branchScope, can, canWriteClaim, isLoading: wsLoading } = useOwnerWorkspace();
  const canWrite = can("write");
  const scope = role === "staff" ? branchScope : null;

  const { rows, isLoading, isError, refetch } = useOwnerOutcomesOverview(workspaceId);
  const { data: branchOptions = [] } = useWorkspaceBranchOptions(workspaceId);
  const branches = useMemo(() => branchOptions.map((b) => ({ id: b.id, label: b.label })), [branchOptions]);
  const branchNames = useMemo(() => new Map(branches.map((b) => [b.id, b.label])), [branches]);

  const today = useMemo(() => todayIso(), []);
  const periodGroups = useMemo(() => ownerPeriodGroups(today), [today]);
  const [f, , setFilters] = useUrlFilterState(DEFAULTS, {
    period: ownerPeriodIds(today),
    outcome: OUTCOME_FILTERS,
    source: ["all", ...OUTCOME_CONFIDENCES],
    lech: ["0", "1"],
  });

  const visible = useMemo(
    () =>
      sortOverview(
        filterOverview(
          rows,
          { ...f, outcome: f.outcome as OutcomeFilter, conflictOnly: f.lech === "1" },
          today,
        ),
      ),
    [rows, f, today],
  );
  const totals = useMemo(() => summarizeOutcomes(visible), [visible]);
  const conflicts = useMemo(() => rows.filter((r) => r.hasConflict), [rows]);

  // Giữ target khi đóng để dialog không trống chữ lúc đang tắt dần.
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const openDialog = (target: OutcomeDialogTarget, record: OwnerOutcomeRecord | null = null) => {
    setDialog({ target, record });
    setDialogOpen(true);
  };
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const sheetRow = rows.find((r) => r.rowKey === sheetKey) ?? null;
  const [importOpen, setImportOpen] = useState(false);

  if (wsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workspaceId || !workspace) {
    return (
      <OwnerNoWorkspaceState icon={Gavel}>
        <EmptyState
          icon={Gavel}
          title="Chưa có không gian làm việc"
          description="Kết quả phiên dành cho chủ tài sản là tổ chức đã xác thực, hoặc người được một đơn vị mời vào."
          action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Xác thực tổ chức</Button>}
        />
      </OwnerNoWorkspaceState>
    );
  }

  const newOffPlatform = () =>
    openDialog({ kind: "offplatform", branchId: scope?.length === 1 ? scope[0] : null });

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Kết quả phiên"
        subtitle="Kết quả đấu giá của mọi tài sản — trên sàn và ngoài sàn, kèm nguồn của từng con số"
        actions={
          canWrite && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}>
                <FileSpreadsheet className="h-4 w-4" strokeWidth={1.5} />
                Nhập từ Excel
              </Button>
              <Button className="gap-1.5" onClick={newOffPlatform}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Khai tài sản ngoài sàn
              </Button>
            </div>
          )
        }
      />

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <EmptyState
          icon={Gavel}
          tone="destructive"
          title="Chưa tải được kết quả phiên."
          action={
            <Button variant="outline" onClick={() => void refetch()}>
              Thử lại
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title="Chưa có kết quả phiên nào"
          description="Kết quả phiên trên sàn và số tổ chức đấu giá báo sẽ tự hiện ở đây. Tài sản đấu giá ngoài sàn: khai tay hoặc nhập từ Excel."
          action={canWrite ? <Button onClick={newOffPlatform}>Khai tài sản ngoài sàn</Button> : undefined}
        />
      ) : (
        <>
          <div className="rounded-2xl border bg-card p-5">
            <OutcomeHero totals={totals} periodId={f.period} />
          </div>

          <OutcomeConflictCards
            rows={conflicts}
            onOpen={(r) => setSheetKey(r.rowKey)}
            onShowAll={() => setFilters({ lech: "1", period: "all" })}
          />

          <OutcomeStatGrid totals={totals} />

          <SectionCard title="Tất cả kết quả" icon={Gavel} count={visible.length}>
            <div className="space-y-4">
              <OutcomeFilters
                values={f}
                onChange={(patch) => setFilters(patch)}
                periodGroups={periodGroups}
                branches={branches}
              />
              {visible.length ? (
                <OutcomesTable rows={visible} branchNames={branchNames} onOpen={(r) => setSheetKey(r.rowKey)} />
              ) : (
                <EmptyState
                  compact
                  icon={SearchX}
                  title="Không có tài sản nào khớp bộ lọc."
                  action={
                    <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULTS)}>
                      Xoá bộ lọc
                    </Button>
                  }
                />
              )}
            </div>
          </SectionCard>
        </>
      )}

      <OutcomeConflictSheet
        workspaceId={workspaceId}
        row={sheetRow}
        onClose={() => setSheetKey(null)}
        branchLabel={sheetRow?.branchId ? branchNames.get(sheetRow.branchId) ?? null : null}
        canWrite={!!sheetRow && canWriteClaim(sheetRow.branchId)}
        onEdit={(record) => openDialog({ kind: "offplatform" }, record)}
        onReportNext={(target) => openDialog(target)}
      />

      <ReportOutcomeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workspaceId={workspaceId}
        target={dialog?.target ?? null}
        record={dialog?.record ?? null}
        branches={branches}
        branchScope={scope}
      />

      {importOpen && (
        <OutcomeImportDialog open onOpenChange={setImportOpen} workspaceId={workspaceId} branches={branches} />
      )}
    </div>
  );
};

export default OwnerOutcomesPage;
