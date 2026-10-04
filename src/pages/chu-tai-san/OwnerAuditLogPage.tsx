import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Download, History, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { AuditFilters } from "@/components/asset-owner-portal/audit/AuditFilters";
import { AuditLogTable } from "@/components/asset-owner-portal/audit/AuditLogTable";
import { AuditEntryDialog } from "@/components/asset-owner-portal/audit/AuditEntryDialog";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import {
  AUDIT_PAGE_SIZE,
  fetchOwnerAuditForExport,
  useOwnerAuditLog,
  useOwnerAuditScope,
  useOwnerAuditTrack,
} from "@/hooks/useOwnerAuditLog";
import {
  AUDIT_KIND_LABELS,
  AUDIT_LEVEL_COPY,
  AUDIT_PERIOD_LABELS,
  DEFAULT_AUDIT_FILTERS,
  type AuditEntry,
  type AuditFilterState,
} from "@/lib/ownerAudit";
import { downloadAuditXlsx } from "@/lib/ownerAuditExcel";

/**
 * Nhật ký hoạt động — /chu-tai-san/nhat-ky. Mọi thay đổi dữ liệu (trigger), lượt truy
 * cập / xem trang, xuất / in / chia sẻ của Trạm. Tầng xem do server quyết
 * (owner_audit_context, migration 20261002120000): thao tác của mình / chi nhánh được
 * giao / toàn đơn vị / trụ sở xem chi nhánh — trang chỉ hiển thị tầng trả về.
 */
const OwnerAuditLogPage = () => {
  const navigate = useNavigate();
  const { workspaceId, workspace, isPersonal, personalName, isLoading: wsLoading } = useOwnerWorkspace();
  const track = useOwnerAuditTrack();

  // Ô tìm gõ ngay; truy vấn chạy sau 300 ms ngừng gõ.
  const [draft, setDraft] = useState<AuditFilterState>(DEFAULT_AUDIT_FILTERS);
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setQ(draft.q), 300);
    return () => window.clearTimeout(t);
  }, [draft.q]);
  const filters = useMemo<AuditFilterState>(
    () => ({ q, kind: draft.kind, module: draft.module, actor: draft.actor, branch: draft.branch, period: draft.period }),
    [q, draft.kind, draft.module, draft.actor, draft.branch, draft.period],
  );

  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [filters]);

  const scopeQ = useOwnerAuditScope();
  const logQ = useOwnerAuditLog(filters, page);
  const [openEntry, setOpenEntry] = useState<AuditEntry | null>(null);
  const [exporting, setExporting] = useState(false);

  const scope = scopeQ.data;
  const data = logQ.data;
  const scopeName = isPersonal ? personalName ?? "Cá nhân" : workspace?.primary_name ?? "";

  if (wsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!workspaceId && !isPersonal) {
    return (
      <OwnerNoWorkspaceState icon={History}>
        <EmptyState
          icon={History}
          title="Chưa có không gian làm việc"
          description="Nhật ký hoạt động ghi lại thao tác trong Trạm Điều Hành của đơn vị bạn."
          action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Xác thực tổ chức</Button>}
        />
      </OwnerNoWorkspaceState>
    );
  }

  const handleExport = async () => {
    setExporting(true);
    try {
      const rows = await fetchOwnerAuditForExport(workspaceId, filters);
      const note = [
        AUDIT_PERIOD_LABELS[filters.period],
        filters.kind !== "all" ? AUDIT_KIND_LABELS[filters.kind] : null,
        filters.q ? `tìm “${filters.q}”` : null,
        `${rows.length.toLocaleString("en-US")} dòng`,
      ]
        .filter(Boolean)
        .join(" · ");
      const day = new Date().toISOString().slice(0, 10);
      downloadAuditXlsx(rows, { scopeName, filterNote: note }, `nhat-ky-hoat-dong-${day}.xlsx`);
      track({ action: "export", title: "Nhật ký hoạt động", meta: { rows: rows.length } });
    } catch {
      toast.error("Chưa xuất được nhật ký. Thử lại sau.");
    } finally {
      setExporting(false);
    }
  };

  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : page * AUDIT_PAGE_SIZE + 1;
  const to = Math.min((page + 1) * AUDIT_PAGE_SIZE, total);
  const lastPage = Math.max(Math.ceil(total / AUDIT_PAGE_SIZE) - 1, 0);
  const levelCopy = scope ? AUDIT_LEVEL_COPY[scope.level] : null;

  return (
    <div className="space-y-6">
      <OwnerPageHeader
        title="Nhật ký hoạt động"
        subtitle="Ai đã làm gì, lúc nào trong Trạm Điều Hành — thay đổi dữ liệu, lượt truy cập, xuất và chia sẻ."
        actions={
          scope?.canExport && (
            <Button variant="outline" className="gap-1.5" onClick={handleExport} disabled={exporting || total === 0}>
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <Download className="h-4 w-4" strokeWidth={1.5} />
              )}
              Xuất Excel
            </Button>
          )
        }
      />

      {levelCopy && (
        <div className="flex items-start gap-3 rounded-2xl bg-card px-4 py-3 shadow-card">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-foreground">{levelCopy.title}</p>
            <p className="text-muted-foreground">{levelCopy.description}</p>
          </div>
        </div>
      )}

      <AuditFilters value={draft} onChange={setDraft} scope={scope} />

      <SectionCard title={scopeName || "Nhật ký"} icon={History} count={total}>
        {logQ.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : logQ.isError ? (
          <EmptyState
            compact
            tone="destructive"
            icon={History}
            title="Chưa tải được nhật ký."
            action={
              <Button size="sm" variant="outline" onClick={() => void logQ.refetch()}>
                Thử lại
              </Button>
            }
          />
        ) : total === 0 ? (
          <EmptyState
            icon={History}
            title="Không có hoạt động nào khớp bộ lọc"
            description="Thử mở rộng khoảng thời gian hoặc bỏ bớt bộ lọc."
          />
        ) : (
          <>
            <AuditLogTable rows={data?.rows ?? []} onOpen={setOpenEntry} />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm text-muted-foreground">
              <span className="tabular-nums">
                {from.toLocaleString("en-US")}–{to.toLocaleString("en-US")} / {total.toLocaleString("en-US")}
                {data?.totalCapped && "+"} hoạt động
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  disabled={page === 0 || logQ.isFetching}
                  onClick={() => setPage((p) => Math.max(p - 1, 0))}
                >
                  <ChevronLeft className="h-4 w-4" strokeWidth={1.5} /> Mới hơn
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1"
                  disabled={page >= lastPage || logQ.isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Cũ hơn <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      <AuditEntryDialog entry={openEntry} onOpenChange={(open) => !open && setOpenEntry(null)} />
    </div>
  );
};

export default OwnerAuditLogPage;
