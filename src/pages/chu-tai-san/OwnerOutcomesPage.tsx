import { useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileSpreadsheet, Gavel, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ReportOutcomeDialog } from "@/components/asset-owner-portal/outcomes/ReportOutcomeDialog";
import { LedgerFilters, type LedgerFilterValues } from "@/components/asset-owner-portal/outcomes-page/LedgerFilters";
import { LedgerTabs } from "@/components/asset-owner-portal/outcomes-page/LedgerTabs";
import { OutcomeDetailDrawer } from "@/components/asset-owner-portal/outcomes-page/OutcomeDetailDrawer";
import { OutcomeImportDialog } from "@/components/asset-owner-portal/outcomes-page/OutcomeImportDialog";
import { OutcomeInbox, type PendingInboxItem } from "@/components/asset-owner-portal/outcomes-page/OutcomeInbox";
import { OutcomeLedgerTable } from "@/components/asset-owner-portal/outcomes-page/OutcomeLedgerTable";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerOutcomesOverview } from "@/hooks/useOwnerOutcomesOverview";
import { useOwnerPulse } from "@/hooks/useOwnerPulse";
import { useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";
import { useUrlFilterState } from "@/hooks/useUrlFilterState";
import { BRANCH_ALL, filterOverview, sortOverview, summarizeOutcomes } from "@/lib/ownerOutcomesOverview";
import { LEDGER_TABS, toLedgerRows, type LedgerTab } from "@/lib/ownerOutcomesLedger";
import { DEFAULT_RECENT_PERIOD, RECENT_PERIODS } from "@/lib/ownerPeriods";
import { todayIso, type OutcomeDialogTarget, type ReportKind } from "@/lib/ownerOutcomeReport";
import type { OwnerOutcomeRecord } from "@/lib/ownerOutcomeEdit";

const DEFAULTS: LedgerFilterValues = {
  tab: "todo",
  period: DEFAULT_RECENT_PERIOD,
  branch: BRANCH_ALL,
  q: "",
};

interface DialogState {
  target: OutcomeDialogTarget;
  record: OwnerOutcomeRecord | null;
  kind: ReportKind;
}

/**
 * "Kết quả phiên" — /chu-tai-san/ket-qua (docs/owner-control-tower-plan.md Phase 8),
 * bố cục theo design "Ket Qua Phien Chu Tai San": một thẻ sổ với tab Cần xử lý
 * (lệch số liệu + phiên chưa khai) / Tất cả / Thành / Không thành / Hoãn–Huỷ.
 * Gộp nguồn ở server (RPC owner_outcomes_overview); bấm dòng mở ngăn chi tiết.
 */
const OwnerOutcomesPage = () => {
  const navigate = useNavigate();
  const panelId = useId();
  const { workspaceId, workspace, isScoped, branchScope, can, canIn, isLoading: wsLoading } = useOwnerWorkspace();
  const canWrite = can("ket-qua", "update");
  const scope = isScoped ? branchScope : null;

  const { rows: overview, isLoading, isError, refetch } = useOwnerOutcomesOverview(workspaceId);
  // Phiên đã qua mà chưa khai kết quả — cùng cache với huy hiệu sidebar.
  const { outcomeDue, metrics, isLoading: dueLoading } = useOwnerPulse();
  const { data: branchOptions = [] } = useWorkspaceBranchOptions(workspaceId);
  const branches = useMemo(() => branchOptions.map((b) => ({ id: b.id, label: b.label })), [branchOptions]);
  const branchNames = useMemo(() => new Map(branches.map((b) => [b.id, b.label])), [branches]);

  // Địa chỉ / số phiên của tin trên sàn lấy từ danh mục đã tải (RPC không trả).
  const listings = useMemo(() => new Map(metrics.allListings.map((l) => [l.id, l])), [metrics.allListings]);
  const rows = useMemo(() => toLedgerRows(overview, listings), [overview, listings]);
  const conflicts = useMemo(() => sortOverview(rows.filter((r) => r.hasConflict)), [rows]);
  const pending = useMemo<PendingInboxItem[]>(
    () =>
      outcomeDue.map((item) => {
        const l = listings.get(item.listingId);
        return {
          ...item,
          orgName: l?.auctionOrgName ?? null,
          address: l?.addressLine || null,
          round: l?.roundCount || null,
        };
      }),
    [outcomeDue, listings],
  );

  const today = useMemo(() => todayIso(), []);
  const [f, , setFilters] = useUrlFilterState(DEFAULTS, { tab: LEDGER_TABS, period: RECENT_PERIODS });
  const tab = f.tab as LedgerTab;

  // Tóm tắt + số trên tab tính theo thời gian / chi nhánh / tìm kiếm, bỏ qua tab.
  const base = useMemo(
    () =>
      filterOverview(
        rows,
        { period: f.period, branch: f.branch, outcome: "all", source: "all", conflictOnly: false, q: f.q },
        today,
      ),
    [rows, f.period, f.branch, f.q, today],
  );
  const totals = useMemo(() => summarizeOutcomes(base), [base]);
  const list = useMemo(
    () =>
      sortOverview(
        tab === "todo" || tab === "all"
          ? base
          : filterOverview(
              rows,
              { period: f.period, branch: f.branch, outcome: tab, source: "all", conflictOnly: false, q: f.q },
              today,
            ),
      ),
    [rows, base, tab, f.period, f.branch, f.q, today],
  );
  const counts: Record<LedgerTab, number> = {
    todo: conflicts.length + pending.length,
    all: totals.total,
    sold: totals.sold,
    unsold: totals.unsold,
    void: totals.voided,
  };

  // Giữ target khi đóng để dialog không trống chữ lúc đang tắt dần.
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const openDialog = (
    target: OutcomeDialogTarget,
    record: OwnerOutcomeRecord | null = null,
    kind: ReportKind = "sold",
  ) => {
    setDialog({ target, record, kind });
    setDialogOpen(true);
  };
  const [drawerKey, setDrawerKey] = useState<string | null>(null);
  const drawerRow = rows.find((r) => r.rowKey === drawerKey) ?? null;
  const [importOpen, setImportOpen] = useState(false);

  if (wsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-[420px] w-full rounded-2xl" />
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

  const newOffPlatform = () => openDialog({ kind: "offplatform", branchId: scope?.length === 1 ? scope[0] : null });

  return (
    <div className="space-y-[22px]">
      <OwnerPageHeader
        title="Kết quả phiên"
        subtitle="Sổ kết quả của mọi phiên đã diễn ra — mỗi con số đều ghi rõ nguồn."
        actions={
          canWrite && (
            <>
              <Button variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}>
                <FileSpreadsheet className="h-4 w-4" strokeWidth={1.5} />
                Nhập từ Excel
              </Button>
              <Button variant="outline" className="gap-1.5" onClick={newOffPlatform}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Khai tài sản ngoài sàn
              </Button>
            </>
          )
        }
      />

      {isLoading ? (
        <Skeleton className="h-[420px] w-full rounded-2xl" />
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
      ) : (
        <section
          aria-label="Sổ kết quả phiên"
          className="flex flex-col gap-3 rounded-2xl bg-card px-5 py-[18px] shadow-card print:border print:shadow-none"
        >
          <LedgerTabs
            tab={tab}
            onChange={(t) => setFilters({ tab: t })}
            counts={counts}
            soldValue={totals.soldValue}
            successRate={totals.successRate}
            panelId={panelId}
          />
          <div id={panelId} role="tabpanel" className="flex flex-col gap-3">
            {tab === "todo" ? (
              <OutcomeInbox
                workspaceId={workspaceId}
                conflicts={conflicts}
                pending={pending}
                loading={dueLoading}
                canWriteRow={(r) => canIn("ket-qua", "update", r.branchId)}
                onReport={(item, kind) =>
                  openDialog(
                    {
                      listingId: item.listingId,
                      title: item.title,
                      startingPrice: item.startingPrice,
                      auctionTime: item.auctionTime,
                    },
                    null,
                    kind,
                  )
                }
                onOpen={(r) => setDrawerKey(r.rowKey)}
              />
            ) : (
              <>
                <LedgerFilters values={f} onChange={(patch) => setFilters(patch)} branches={branches} />
                <OutcomeLedgerTable
                  key={`${tab}|${f.period}|${f.branch}|${f.q}`}
                  rows={list}
                  hasAnyRow={rows.length > 0}
                  onOpen={(r) => setDrawerKey(r.rowKey)}
                />
              </>
            )}
          </div>
        </section>
      )}

      <OutcomeDetailDrawer
        workspaceId={workspaceId}
        row={drawerRow}
        onClose={() => setDrawerKey(null)}
        branchLabel={drawerRow?.branchId ? (branchNames.get(drawerRow.branchId) ?? null) : null}
        canWrite={!!drawerRow && canIn("ket-qua", "update", drawerRow.branchId)}
        canDelete={!!drawerRow && canIn("ket-qua", "delete", drawerRow.branchId)}
        onEdit={(record) => openDialog({ kind: "offplatform" }, record)}
        onReportNext={(target) => openDialog(target)}
      />

      <ReportOutcomeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workspaceId={workspaceId}
        target={dialog?.target ?? null}
        record={dialog?.record ?? null}
        defaultKind={dialog?.kind}
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
