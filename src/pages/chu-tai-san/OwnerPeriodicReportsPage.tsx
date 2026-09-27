import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileBarChart, Loader2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ActionCard } from "@/components/asset-owner-portal/ui/ActionCard";
import { CreateReportDialog } from "@/components/asset-owner-portal/periodic-report/CreateReportDialog";
import { OwnerReportsTable } from "@/components/asset-owner-portal/periodic-report/OwnerReportsTable";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerReports } from "@/hooks/useOwnerPeriodicReports";
import { useOwnerWorkspaceMembers, useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";
import { todayIso } from "@/lib/ownerOutcomeReport";
import { periodLabel } from "@/lib/ownerTargets";
import {
  previousPeriodStart,
  reportHref,
  reportScopeLabel,
  type OwnerReportListItem,
} from "@/lib/ownerPeriodicReport";
import { OWNER_REPORT_TABS, filterOwnerReports, ownerReportTabCounts, type OwnerReportTab } from "@/lib/ownerReportTabs";

const EMPTY_TEXT: Record<OwnerReportTab, string> = {
  draft: "Không có bản nháp nào chờ chốt.",
  final: "Chưa có báo cáo nào được chốt.",
  all: "Chưa có báo cáo nào.",
};

// ActionCard vốn nằm TRONG thẻ (có viền); ở đây nó nằm thẳng trên nền xám ⇒ làm thẻ trang.
const PAGE_LEVEL_CARD = "border-0 bg-card shadow-card";

/**
 * "Báo cáo định kỳ" — /chu-tai-san/bao-cao-dinh-ky (docs/owner-control-tower-plan.md Phase 10).
 * Cùng kiểu với "Hợp đồng mua bán": nhắc việc (tháng trước chưa báo cáo) → tab có số đếm
 * → ô tìm + bảng. Bấm dòng mở chi tiết.
 */
const OwnerPeriodicReportsPage = () => {
  const navigate = useNavigate();
  const { workspaceId, workspace, isScoped, branchScope, can, isLoading: wsLoading } = useOwnerWorkspace();
  const { reports, isLoading, isError, refetch } = useOwnerReports(workspaceId);
  const { data: branchOptions = [] } = useWorkspaceBranchOptions(workspaceId);
  const { data: members = [] } = useOwnerWorkspaceMembers(workspaceId);
  const [createOpen, setCreateOpen] = useState(false);

  // Người bị giới hạn chi nhánh chỉ lập báo cáo cho chi nhánh của mình (RLS cũng chặn).
  const allowedBranchIds = isScoped && branchScope ? branchScope : null;
  const canCreate = can("bao-cao-dinh-ky", "create") && (!allowedBranchIds || allowedBranchIds.length > 0);

  const branchNames = useMemo(() => new Map(branchOptions.map((b) => [b.id, b.label])), [branchOptions]);
  const memberNames = useMemo(() => new Map(members.map((m) => [m.userId, m.fullName || m.email])), [members]);
  const scopeOf = (r: OwnerReportListItem) =>
    r.frozenScope
      ? reportScopeLabel(r.frozenScope)
      : r.branchId
        ? branchNames.get(r.branchId) ?? "Chi nhánh"
        : "Toàn đơn vị";
  const preparedBy = (r: OwnerReportListItem) =>
    (r.createdBy && memberNames.get(r.createdBy)) || r.frozenPreparedBy || "—";

  const counts = useMemo(() => ownerReportTabCounts(reports), [reports]);
  // Chưa chọn tab ⇒ mở "Nháp chờ chốt" nếu có nháp, không thì "Đã chốt".
  const [picked, setPicked] = useState<OwnerReportTab | null>(null);
  const tab: OwnerReportTab = picked ?? (counts.draft > 0 ? "draft" : "final");
  const [q, setQ] = useState("");
  const visible = filterOwnerReports(reports, tab, q, (r) => `${scopeOf(r)} ${preparedBy(r)}`);

  const today = useMemo(() => todayIso(), []);
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Báo cáo định kỳ</h1>
          <p className="text-sm text-muted-foreground">
            Tổng hợp kết quả phiên, tiền thu, tồn đọng và kế hoạch theo tháng / quý / năm để gửi trụ sở.
          </p>
        </div>
        {canCreate && (
          <Button className="shrink-0 gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Tạo báo cáo
          </Button>
        )}
      </div>

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
          {canCreate && !prevMonthDone && (
            <ActionCard
              icon={FileBarChart}
              tone="warning"
              className={PAGE_LEVEL_CARD}
              title={`${periodLabel("month", prevMonth).replace(/^./, (c) => c.toUpperCase())} chưa có báo cáo đã chốt`}
              meta="Hệ thống tự tổng hợp số liệu tháng vừa qua — bạn chỉ cần thêm ghi chú rồi chốt để gửi trụ sở."
              actions={
                <Button size="sm" variant="outline" onClick={openCreate}>
                  Tạo báo cáo
                </Button>
              }
            />
          )}

          {reports.length === 0 ? (
            <Card className="rounded-2xl p-10 text-center text-sm text-muted-foreground">
              Chưa có báo cáo nào. Báo cáo đã chốt được đóng băng số liệu — sửa kết quả phiên sau đó không làm đổi
              báo cáo.
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {OWNER_REPORT_TABS.map((t) => (
                  <Button
                    key={t.key}
                    variant={tab === t.key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPicked(t.key)}
                    className="gap-1.5"
                  >
                    {t.label}
                    {t.key === "draft" && counts.draft > 0 ? (
                      <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-accent-foreground">
                        {counts.draft}
                      </span>
                    ) : (
                      <span className={tab === t.key ? "opacity-80" : "text-muted-foreground"}>{counts[t.key]}</span>
                    )}
                  </Button>
                ))}
              </div>

              <Card className="rounded-2xl">
                <div className="border-b p-4">
                  <div className="relative max-w-sm">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                      aria-hidden
                    />
                    <Input
                      aria-label="Tìm báo cáo"
                      className="pl-8"
                      value={q}
                      placeholder="Kỳ báo cáo, chi nhánh, người lập…"
                      onChange={(e) => setQ(e.target.value)}
                    />
                  </div>
                </div>
                <OwnerReportsTable
                  rows={visible}
                  scopeOf={scopeOf}
                  preparedBy={preparedBy}
                  emptyText={q ? "Không có báo cáo nào khớp từ khoá." : EMPTY_TEXT[tab]}
                />
              </Card>
            </>
          )}
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
