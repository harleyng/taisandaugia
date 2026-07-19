import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useLeads, useDeleteLead, useConvertLead, leadErrorMessage } from "@/hooks/useLeads";
import { LeadTable } from "@/components/admin/leads/LeadTable";
import { LeadFormDialog } from "@/components/admin/leads/LeadFormDialog";
import { STATUS_TABS } from "@/lib/leads/leadStatus";
import type { Lead, LeadStatus } from "@/types/leads";

type StatusFilter = LeadStatus | "all";

const pill = (active: boolean) =>
  [
    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
  ].join(" ");

export default function AdminLeadsPage() {
  const { data: leads, isLoading } = useLeads();
  const del = useDeleteLead();
  const convert = useConvertLead();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
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
      if (!q) return true;
      return (
        l.name.toLowerCase().includes(q) ||
        (l.code ?? "").toLowerCase().includes(q) ||
        (l.phone ?? "").includes(q) ||
        (l.email ?? "").toLowerCase().includes(q) ||
        (l.contact_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, search, status]);

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

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm theo tên, mã, SĐT, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <LeadTable
        leads={filtered}
        isLoading={isLoading}
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
