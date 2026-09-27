import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileBarChart, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ActionCard } from "@/components/asset-owner-portal/ui/ActionCard";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { CreateReportDialog } from "@/components/asset-owner-portal/periodic-report/CreateReportDialog";
import { OwnerReportsTable } from "@/components/asset-owner-portal/periodic-report/OwnerReportsTable";
import { ReportDueCard } from "@/components/asset-owner-portal/periodic-report/ReportDueCard";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useDraftReportPreviews, useOwnerReports } from "@/hooks/useOwnerPeriodicReports";
import { useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";
import { todayIso } from "@/lib/ownerOutcomeReport";
import { periodLabel } from "@/lib/ownerTargets";
import {
  previousPeriodStart,
  reportHref,
  reportScopeLabel,
  type OwnerReportListItem,
} from "@/lib/ownerPeriodicReport";
import { reportDueDate, reportFigures, type ReportFigures } from "@/lib/ownerReportDigest";

// ActionCard vốn nằm TRONG thẻ (có viền); ở đây nó nằm thẳng trên nền xám ⇒ làm thẻ trang.
const PAGE_LEVEL_CARD = "border-0 bg-card shadow-card";

/**
 * "Báo cáo định kỳ" — /chu-tai-san/bao-cao-dinh-ky (Phase 10; design "Bao Cao Dinh Ky Chu
 * Tai San"): thẻ nhắc bản nháp chờ chốt (hoặc tháng trước chưa có báo cáo) → một bảng
 * mọi kỳ, mới nhất trước. Bấm dòng mở chi tiết.
 */
const OwnerPeriodicReportsPage = () => {
  const navigate = useNavigate();
  const { workspaceId, workspace, isScoped, branchScope, can, isLoading: wsLoading } = useOwnerWorkspace();
  const { reports, isLoading, isError, refetch } = useOwnerReports(workspaceId);
  const { data: branchOptions = [] } = useWorkspaceBranchOptions(workspaceId);
  const previews = useDraftReportPreviews(reports);
  const [createOpen, setCreateOpen] = useState(false);

  // Người bị giới hạn chi nhánh chỉ lập báo cáo cho chi nhánh của mình (RLS cũng chặn).
  const allowedBranchIds = isScoped && branchScope ? branchScope : null;
  const canCreate = can("bao-cao-dinh-ky", "create") && (!allowedBranchIds || allowedBranchIds.length > 0);

  const branchNames = useMemo(() => new Map(branchOptions.map((b) => [b.id, b.label])), [branchOptions]);
  const scopeOf = (r: OwnerReportListItem) =>
    r.frozenScope
      ? reportScopeLabel(r.frozenScope)
      : r.branchId
        ? branchNames.get(r.branchId) ?? "Chi nhánh"
        : "Toàn đơn vị";
  const figuresOf = (r: OwnerReportListItem): ReportFigures | undefined => {
    if (r.status === "draft") {
      const p = previews.get(r.id);
      return p ? reportFigures(p) : undefined;
    }
    return { soldValue: r.soldValue ?? 0, collected: r.collected ?? 0, targetPct: r.targetPct };
  };

  const today = useMemo(() => todayIso(), []);
  // Bản nháp kỳ sớm nhất (danh sách xếp kỳ mới trước) — việc cần làm trước tiên.
  const dueDraft = [...reports].reverse().find((r) => r.status === "draft");
  const dueDate = dueDraft ? reportDueDate(dueDraft.periodType, dueDraft.periodStart) : null;
  const prevMonth = previousPeriodStart("month", today);
  const prevMonthDone = reports.some(
    (r) =>
      r.status === "final" &&
      r.periodType === "month" &&
      r.periodStart === prevMonth &&
      (allowedBranchIds ? !!r.branchId && allowedBranchIds.includes(r.branchId) : r.branchId === null),
  );

  if (wsLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-56" />
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

  return (
    <div className="space-y-5">
      <OwnerPageHeader
        title="Báo cáo định kỳ"
        subtitle="Hệ thống tự tổng hợp số liệu mỗi kỳ. Bạn chỉ cần rà soát, thêm nhận định rồi chốt để gửi trụ sở."
        actions={
          canCreate && (
            <Button variant="outline" className="gap-1.5" onClick={openCreate}>
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Tạo báo cáo
            </Button>
          )
        }
      />

      {isLoading ? (
        <Card className="flex items-center justify-center gap-2 rounded-2xl p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Đang tải báo cáo…
        </Card>
      ) : isError ? (
        <Card className="space-y-3 rounded-2xl p-10 text-center">
          <p className="text-sm text-destructive">Chưa tải được danh sách báo cáo.</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Thử lại
          </Button>
        </Card>
      ) : (
        <>
          {dueDraft && dueDate ? (
            <ReportDueCard
              report={dueDraft}
              dueDate={dueDate}
              overdue={today > dueDate}
              onOpen={() => navigate(reportHref(dueDraft.id))}
            />
          ) : (
            canCreate &&
            !prevMonthDone && (
              <ActionCard
                icon={FileBarChart}
                tone="warning"
                className={PAGE_LEVEL_CARD}
                title={`${periodLabel("month", prevMonth).replace(/^./, (c) => c.toUpperCase())} chưa có báo cáo đã chốt`}
                meta="Hệ thống tự tổng hợp số liệu tháng vừa qua — bạn chỉ cần thêm nhận định rồi chốt để gửi trụ sở."
                actions={
                  <Button size="sm" variant="outline" onClick={openCreate}>
                    Tạo báo cáo
                  </Button>
                }
              />
            )
          )}

          <Card className="rounded-2xl border-0 px-[18px] py-1.5 shadow-card">
            {reports.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Chưa có báo cáo nào. Báo cáo đã chốt được đóng băng số liệu — sửa kết quả phiên sau đó không làm đổi
                báo cáo.
              </p>
            ) : (
              <OwnerReportsTable rows={reports} figuresOf={figuresOf} scopeOf={scopeOf} today={today} />
            )}
          </Card>
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
