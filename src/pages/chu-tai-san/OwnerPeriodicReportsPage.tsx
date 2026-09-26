import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCheck, FileBarChart, NotebookPen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ActionCard } from "@/components/asset-owner-portal/ui/ActionCard";
import { HeroFigure } from "@/components/asset-owner-portal/ui/HeroFigure";
import { CreateReportDialog } from "@/components/asset-owner-portal/periodic-report/CreateReportDialog";
import { ReportsTable } from "@/components/asset-owner-portal/periodic-report/ReportsTable";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerReports } from "@/hooks/useOwnerPeriodicReports";
import { useOwnerWorkspaceMembers, useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";
import { todayIso } from "@/lib/ownerOutcomeReport";
import { periodLabel } from "@/lib/ownerTargets";
import { formatReportDay, previousPeriodStart, reportHref, reportScopeLabel } from "@/lib/ownerPeriodicReport";
import { moneyShortParts } from "@/utils/money";

/**
 * "Báo cáo định kỳ" — /chu-tai-san/bao-cao-dinh-ky (docs/owner-control-tower-plan.md Phase 10).
 * L1 báo cáo gần nhất đã chốt → L2 việc cần làm (tháng trước chưa báo cáo, nháp chờ chốt)
 * → L4 danh sách mọi báo cáo.
 */
const OwnerPeriodicReportsPage = () => {
  const navigate = useNavigate();
  const { workspaceId, workspace, role, branchScope, can, isLoading: wsLoading } = useOwnerWorkspace();
  const { reports, isLoading, isError, refetch } = useOwnerReports(workspaceId);
  const { data: branchOptions = [] } = useWorkspaceBranchOptions(workspaceId);
  const { data: members = [] } = useOwnerWorkspaceMembers(workspaceId);
  const [createOpen, setCreateOpen] = useState(false);

  // Cán bộ bị giới hạn chi nhánh chỉ lập báo cáo cho chi nhánh của mình (RLS cũng chặn).
  const allowedBranchIds = role === "staff" && branchScope ? branchScope : null;
  const canCreate = can("write") && (!allowedBranchIds || allowedBranchIds.length > 0);
  const canFinalize = can("send_report");

  const branchNames = useMemo(() => new Map(branchOptions.map((b) => [b.id, b.label])), [branchOptions]);
  const memberNames = useMemo(() => new Map(members.map((m) => [m.userId, m.fullName || m.email])), [members]);

  const today = useMemo(() => todayIso(), []);
  const prevMonth = previousPeriodStart("month", today);
  const lastFinal = useMemo(
    () =>
      reports
        .filter((r) => r.status === "final")
        .sort((a, b) => (b.finalizedAt ?? "").localeCompare(a.finalizedAt ?? ""))[0] ?? null,
    [reports],
  );
  const drafts = reports.filter((r) => r.status === "draft");
  const prevMonthDone = reports.some(
    (r) =>
      r.status === "final" &&
      r.periodType === "month" &&
      r.periodStart === prevMonth &&
      (allowedBranchIds ? !!r.branchId && allowedBranchIds.includes(r.branchId) : r.branchId === null),
  );

  if (wsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workspaceId || !workspace) {
    return (
      <OwnerNoWorkspaceState icon={FileBarChart}>
        <EmptyState
          icon={FileBarChart}
          title="Chưa có không gian làm việc"
          description="Báo cáo định kỳ dành cho chủ tài sản là tổ chức đã xác thực, hoặc người được một đơn vị mời vào."
          action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Xác thực tổ chức</Button>}
        />
      </OwnerNoWorkspaceState>
    );
  }

  const openCreate = () => setCreateOpen(true);
  const lastMoney = moneyShortParts(lastFinal?.collected ?? null);

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Báo cáo định kỳ"
        subtitle="Tổng hợp kết quả phiên, tiền thu, tồn đọng và kế hoạch theo tháng / quý / năm để gửi trụ sở"
        actions={
          canCreate && (
            <Button className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Tạo báo cáo
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : isError ? (
        <EmptyState
          icon={FileBarChart}
          tone="destructive"
          title="Chưa tải được danh sách báo cáo."
          action={
            <Button variant="outline" onClick={() => void refetch()}>
              Thử lại
            </Button>
          }
        />
      ) : (
        <>
          {/* L1 — báo cáo gần nhất đã gửi */}
          <div className="rounded-2xl border bg-card p-5">
            {lastFinal ? (
              <HeroFigure
                label={`Đã thu ${periodLabel(lastFinal.periodType, lastFinal.periodStart)} · báo cáo gần nhất đã chốt`}
                value={lastMoney.value}
                unit={lastMoney.unit}
                context={[
                  lastFinal.frozenScope ? reportScopeLabel(lastFinal.frozenScope) : null,
                  lastFinal.soldCount !== null ? `${lastFinal.soldCount} tài sản đấu thành` : null,
                  `chốt ngày ${formatReportDay(lastFinal.finalizedAt)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ) : (
              <EmptyState
                compact
                icon={FileBarChart}
                title="Chưa có báo cáo nào được chốt."
                description="Lập báo cáo tháng vừa qua — hệ thống tự tổng hợp số liệu, bạn chỉ cần thêm ghi chú."
              />
            )}
          </div>

          {/* L2 — việc cần làm */}
          <div className="space-y-2">
            {canCreate && !prevMonthDone && (
              <ActionCard
                icon={FileBarChart}
                tone="warning"
                title={`${periodLabel("month", prevMonth).replace(/^./, (c) => c.toUpperCase())} chưa có báo cáo đã chốt`}
                meta="Tổng hợp số liệu tháng vừa qua để gửi trụ sở."
                actions={
                  <Button size="sm" variant="outline" onClick={openCreate}>
                    Tạo báo cáo
                  </Button>
                }
              />
            )}
            {drafts.length > 0 && (
              <ActionCard
                icon={NotebookPen}
                title={`${drafts.length} bản nháp chờ chốt`}
                meta={
                  canFinalize
                    ? "Xem lại số liệu, thêm ghi chú rồi chốt để gửi trụ sở."
                    : "Trưởng đơn vị sẽ xem lại và chốt để gửi trụ sở."
                }
                actions={
                  <Button size="sm" variant="outline" onClick={() => navigate(reportHref(drafts[0].id))}>
                    Mở bản nháp
                  </Button>
                }
              />
            )}
            {(!canCreate || prevMonthDone) && drafts.length === 0 && (
              <EmptyState compact icon={CheckCheck} tone="success" title="Không có báo cáo nào đang chờ — tốt lắm." />
            )}
          </div>

          {/* L4 — mọi báo cáo */}
          <SectionCard title="Tất cả báo cáo" icon={FileBarChart} count={reports.length}>
            {reports.length ? (
              <ReportsTable reports={reports} branchNames={branchNames} memberNames={memberNames} />
            ) : (
              <EmptyState
                icon={FileBarChart}
                title="Chưa có báo cáo nào"
                description="Báo cáo đã chốt được đóng băng số liệu — sửa kết quả phiên sau đó không làm đổi báo cáo."
                action={canCreate ? <Button onClick={openCreate}>Tạo báo cáo</Button> : undefined}
              />
            )}
          </SectionCard>
        </>
      )}

      <CreateReportDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
        branches={branchOptions}
        allowedBranchIds={allowedBranchIds}
        existing={reports}
        onCreated={(id) => navigate(reportHref(id))}
      />
    </div>
  );
};

export default OwnerPeriodicReportsPage;
