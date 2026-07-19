import { useMemo, useState } from "react";
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
import { useTickets, useDeleteTicket } from "@/hooks/useTickets";
import { TicketTable } from "@/components/admin/tickets/TicketTable";
import { TicketFormDialog } from "@/components/admin/tickets/TicketFormDialog";
import { STATUS_TABS, SOURCE_LABELS, isOpenStatus } from "@/lib/tickets/ticketStatus";
import type { Ticket, TicketSource } from "@/types/tickets";

type Filter = (typeof STATUS_TABS)[number]["key"];
const ALL_SOURCES = "__all__";

const pill = (active: boolean) =>
  [
    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
  ].join(" ");

/**
 * Hàng đợi DUY NHẤT cho mọi yêu cầu vào — thay thế hộp thư "Liên hệ & Hợp tác".
 * Form công khai sinh ticket qua trigger cầu nối, không còn nhập tay hai nơi.
 */
export default function AdminTicketsPage() {
  const { data: tickets, isLoading } = useTickets();
  const del = useDeleteTicket();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [source, setSource] = useState(ALL_SOURCES);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ticket | null>(null);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: tickets?.length ?? 0 };
    for (const t of tickets ?? []) map[t.status] = (map[t.status] ?? 0) + 1;
    return map;
  }, [tickets]);

  const openCount = useMemo(
    () => (tickets ?? []).filter((t) => isOpenStatus(t.status)).length,
    [tickets],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tickets ?? []).filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (source !== ALL_SOURCES && t.source !== source) return false;
      if (!q) return true;
      return (
        t.subject.toLowerCase().includes(q) ||
        (t.code ?? "").toLowerCase().includes(q) ||
        (t.body ?? "").toLowerCase().includes(q) ||
        (t.requester_name ?? "").toLowerCase().includes(q) ||
        (t.requester_phone ?? "").includes(q)
      );
    });
  }, [tickets, search, filter, source]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync(deleteTarget.id);
      toast.success("Đã xóa ticket");
    } catch {
      toast.error("Xóa thất bại");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Ticket</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {counts.all ?? 0} ticket · {openCount} chưa xong · gồm liên hệ &amp; đăng ký hợp tác từ website
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo ticket
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1 mb-4">
        {STATUS_TABS.map((t) => (
          <button key={t.key} className={pill(filter === t.key)} onClick={() => setFilter(t.key)}>
            {t.label} <span className="text-xs opacity-70">({counts[t.key] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tiêu đề, mã, người gửi, SĐT…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Nguồn" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SOURCES}>Tất cả nguồn</SelectItem>
            {(Object.keys(SOURCE_LABELS) as TicketSource[]).map((k) => (
              <SelectItem key={k} value={k}>{SOURCE_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TicketTable
        tickets={filtered}
        isLoading={isLoading}
        onEdit={(t) => { setEditing(t); setDialogOpen(true); }}
        onDelete={setDeleteTarget}
      />

      <TicketFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              Ticket &quot;{deleteTarget?.subject}&quot; sẽ bị xóa. Bản ghi liên hệ gốc từ website vẫn được giữ.
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
