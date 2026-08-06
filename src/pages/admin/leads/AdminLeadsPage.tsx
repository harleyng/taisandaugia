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
import { useLeads, useDeleteLead, useConvertLead, leadErrorMessage } from "@/hooks/useLeads";
import { useProspectStatsMap, useSyncProspectLeads } from "@/hooks/useProspects";
import { LeadTable } from "@/components/admin/leads/LeadTable";
import { LeadFormDialog } from "@/components/admin/leads/LeadFormDialog";
import { STATUS_TABS, SOURCE_LABELS, LEAD_TYPE_LABELS } from "@/lib/leads/leadStatus";
import type { Lead, LeadSource, LeadStatus, LeadType } from "@/types/leads";
import { ENTITY_ROLE_LABELS, entityRole, type EntityRole } from "@/lib/prospects/types";
import type { CustomerSegment } from "@/lib/customers/customerSegment";

type StatusFilter = LeadStatus | "all";
type SourceFilter = LeadSource | "all";
type TypeFilter = LeadType | "all";
type EntityFilter = EntityRole | "all";

const pill = (active: boolean) =>
  [
    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
  ].join(" ");

export default function AdminLeadsPage() {
  const { data: leads, isLoading } = useLeads();
  const del = useDeleteLead();
  const convert = useConvertLead();

  const navigate = useNavigate();

  // Mỗi pháp nhân đang có tài sản trên sàn được ghi thành lead thật với nguồn
  // "Dữ liệu sàn" (RPC idempotent, chạy một lần khi mở trang) — không còn danh
  // sách riêng, không còn thao tác tạo lead thủ công cho nhóm này.
  useSyncProspectLeads();
  const { data: prospectStats } = useProspectStatsMap();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [entity, setEntity] = useState<EntityFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [convertTarget, setConvertTarget] = useState<Lead | null>(null);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: leads?.length ?? 0 };
    for (const l of leads ?? []) map[l.status] = (map[l.status] ?? 0) + 1;
    return map;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (leads ?? []).filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (source !== "all" && l.source !== source) return false;
      if (type !== "all" && l.lead_type !== type) return false;
      // Loại hình chỉ suy ra được cho lead nối với pháp nhân trên sàn; lead nhập
      // tay không có pháp nhân nên bị loại khi lọc theo cá nhân/tổ chức.
      if (entity !== "all") {
        const stat = l.prospect_id
          ? prospectStats?.[`${l.prospect_kind}:${l.prospect_id}`]
          : undefined;
        if (!stat || entityRole(stat.entity_type, stat.parent_id) !== entity) return false;
      }
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        (l.code ?? "").toLowerCase().includes(q) ||
        (l.phone ?? "").includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        (l.contact_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, search, status, source, type, entity, prospectStats]);

  // Chỉ liệt kê nguồn/loại thực sự có dữ liệu, để dropdown không đầy lựa chọn rỗng.
  const sourceOptions = useMemo(() => {
    const set = new Set<LeadSource>();
    for (const l of leads ?? []) set.add(l.source);
    return [...set].sort((a, b) => SOURCE_LABELS[a].localeCompare(SOURCE_LABELS[b], "vi"));
  }, [leads]);

  const typeOptions = useMemo(() => {
    const set = new Set<LeadType>();
    for (const l of leads ?? []) set.add(l.lead_type);
    return [...set].sort((a, b) =>
      (LEAD_TYPE_LABELS[a as CustomerSegment] ?? a).localeCompare(
        LEAD_TYPE_LABELS[b as CustomerSegment] ?? b, "vi",
      ),
    );
  }, [leads]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync(deleteTarget.id);
      toast.success("Đã xóa khách hàng tiềm năng");
    } catch {
      toast.error("Xóa thất bại — có thể còn cơ hội đang gắn");
    }
    setDeleteTarget(null);
  };

  const handleConvert = async () => {
    if (!convertTarget) return;
    try {
      await convert.mutateAsync({ leadId: convertTarget.id });
      toast.success("Đã chuyển thành khách hàng");
    } catch (err) {
      toast.error(leadErrorMessage(err) ?? "Chuyển đổi thất bại");
    }
    setConvertTarget(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Khách hàng tiềm năng</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {counts.all ?? 0} lead · {counts.converted ?? 0} đã chuyển đổi
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm lead
        </Button>
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
        <Select value={type} onValueChange={(v) => setType(v as TypeFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tất cả loại" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả loại</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {LEAD_TYPE_LABELS[t as CustomerSegment] ?? "Khác"}
              </SelectItem>
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
            {sourceOptions.map((s) => (
              <SelectItem key={s} value={s}>{SOURCE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <LeadTable
        leads={filtered}
        isLoading={isLoading}
        prospectStats={prospectStats}
        onOpen={(l) => navigate(`/admin/khach-hang-tiem-nang/${l.id}`)}
        onOpenHistory={(l) => navigate(`/admin/khach-hang-tiem-nang/${l.id}?tab=lich-su`)}
        onEdit={(l) => { setEditing(l); setDialogOpen(true); }}
        onConvert={setConvertTarget}
        onDelete={setDeleteTarget}
      />

      <LeadFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!convertTarget} onOpenChange={(o) => !o && setConvertTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chuyển thành khách hàng?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{convertTarget?.name}&quot; sẽ được tạo thành khách hàng, và mọi cơ hội đang gắn
              sẽ chuyển sang khách hàng đó. Nếu đã có khách trùng SĐT/email, hệ thống sẽ báo để bạn gộp thay vì tạo mới.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvert}>Chuyển đổi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa khách hàng tiềm năng?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.name}&quot; sẽ bị xóa. Không xóa được nếu còn cơ hội đang gắn.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleDelete}>
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
