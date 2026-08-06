import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { customerErrorMessage, useCustomers, useDeleteCustomer } from "@/hooks/useCustomers";
import { useProspectStatsMap } from "@/hooks/useProspects";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { CustomerTable } from "@/components/admin/customers/CustomerTable";
import { CustomerFormDialog } from "@/components/admin/customers/CustomerFormDialog";
import { STATUS_TABS } from "@/lib/customers/customerStatus";
import { SEGMENT_LABELS, type CustomerSegment } from "@/lib/customers/customerSegment";
import { SOURCE_LABELS } from "@/lib/leads/leadStatus";
import { ENTITY_ROLE_LABELS, entityRole, type EntityRole } from "@/lib/prospects/types";
import type { Customer, CustomerStatus } from "@/types/customers";
import type { LeadSource } from "@/types/leads";

type StatusFilter = CustomerStatus | "all";
type SegmentFilter = CustomerSegment | "all";
type EntityFilter = EntityRole | "all";
type SourceFilter = LeadSource | "manual" | "all";

const pill = (active: boolean) =>
  [
    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
  ].join(" ");

export default function AdminCustomersPage() {
  const navigate = useNavigate();
  const { data: customers, isLoading } = useCustomers();
  const del = useDeleteCustomer();

  const canCreate = useHasAdminPermission("khach-hang", "create");
  const canEdit = useHasAdminPermission("khach-hang", "update");
  const canDelete = useHasAdminPermission("khach-hang", "delete");

  // Số liệu tài sản dùng CHUNG cache với danh sách lead — không đồng bộ
  // prospect→lead ở đây, việc đó thuộc trang Khách hàng tiềm năng.
  const { data: prospectStats } = useProspectStatsMap();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [segment, setSegment] = useState<SegmentFilter>("all");
  const [entity, setEntity] = useState<EntityFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: customers?.length ?? 0, converted: 0 };
    for (const c of customers ?? []) {
      map[c.status] = (map[c.status] ?? 0) + 1;
      if (c.source_lead) map.converted += 1;
    }
    return map;
  }, [customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (customers ?? []).filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (segment !== "all" && (c.segment ?? "other") !== segment) return false;
      if (source !== "all") {
        // "manual" = khách nhập tay, không đến từ lead nào.
        if (source === "manual" ? !!c.source_lead : c.source_lead?.source !== source) return false;
      }
      // Loại hình chỉ suy ra được cho khách gắn pháp nhân trên sàn; khách nhập
      // tay không có prospect nên bị loại khi lọc theo cá nhân/tổ chức.
      if (entity !== "all") {
        const stat = c.prospect_id
          ? prospectStats?.[`${c.prospect_kind}:${c.prospect_id}`]
          : undefined;
        if (!stat || entityRole(stat.entity_type, stat.parent_id) !== entity) return false;
      }
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.code ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.contact_name ?? "").toLowerCase().includes(q) ||
        (c.tax_code ?? "").includes(q) ||
        (c.source_lead?.code ?? "").toLowerCase().includes(q)
      );
    });
  }, [customers, search, status, segment, entity, source, prospectStats]);

  // Chỉ liệt kê phân khúc/nguồn thực sự có dữ liệu, để dropdown không đầy lựa
  // chọn rỗng.
  const segmentOptions = useMemo(() => {
    const set = new Set<CustomerSegment>();
    for (const c of customers ?? []) set.add((c.segment ?? "other") as CustomerSegment);
    return [...set].sort((a, b) => SEGMENT_LABELS[a].localeCompare(SEGMENT_LABELS[b], "vi"));
  }, [customers]);

  const sourceOptions = useMemo(() => {
    const set = new Set<LeadSource>();
    for (const c of customers ?? []) if (c.source_lead) set.add(c.source_lead.source);
    return [...set].sort((a, b) => SOURCE_LABELS[a].localeCompare(SOURCE_LABELS[b], "vi"));
  }, [customers]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync(deleteTarget.id);
      toast.success("Đã xóa khách hàng");
    } catch (err) {
      toast.error(customerErrorMessage(err) ?? "Xóa thất bại");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Khách hàng</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {counts.all ?? 0} khách hàng · {counts.converted ?? 0} chuyển đổi từ lead
          </p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Thêm khách hàng
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 mb-4">
        {STATUS_TABS.map((t) => (
          <button key={t.key} className={pill(status === t.key)} onClick={() => setStatus(t.key)}>
            {t.label} <span className="text-xs opacity-70">({counts[t.key] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, mã, SĐT, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={segment} onValueChange={(v) => setSegment(v as SegmentFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tất cả phân khúc" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả phân khúc</SelectItem>
            {segmentOptions.map((s) => (
              <SelectItem key={s} value={s}>{SEGMENT_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entity} onValueChange={(v) => setEntity(v as EntityFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tất cả loại hình" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả loại hình</SelectItem>
            <SelectItem value="main">{ENTITY_ROLE_LABELS.main}</SelectItem>
            <SelectItem value="branch">{ENTITY_ROLE_LABELS.branch}</SelectItem>
            <SelectItem value="individual">{ENTITY_ROLE_LABELS.individual}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(v) => setSource(v as SourceFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tất cả nguồn" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả nguồn</SelectItem>
            <SelectItem value="manual">Nhập tay</SelectItem>
            {sourceOptions.map((s) => (
              <SelectItem key={s} value={s}>{SOURCE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CustomerTable
        customers={filtered}
        isLoading={isLoading}
        prospectStats={prospectStats}
        canEdit={canEdit}
        canDelete={canDelete}
        onOpen={(c) => navigate(`/admin/khach-hang/${c.id}`)}
        onOpenHistory={(c) => navigate(`/admin/khach-hang/${c.id}?tab=lich-su`)}
        onEdit={(c) => { setEditing(c); setDialogOpen(true); }}
        onDelete={setDeleteTarget}
      />

      <CustomerFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa khách hàng?</AlertDialogTitle>
            <AlertDialogDescription>
              Khách hàng &quot;{deleteTarget?.name}&quot; sẽ bị xóa. Không xóa được nếu còn cơ hội
              hoặc đơn hàng đang gắn. Chiến dịch quảng cáo đang gắn khách hàng này sẽ được gỡ liên kết.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
