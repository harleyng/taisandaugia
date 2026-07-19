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
import { useTasks, useDeleteTask, useSetTaskStatus } from "@/hooks/useTasks";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { TaskTable } from "@/components/admin/tasks/TaskTable";
import { TaskFormDialog } from "@/components/admin/tasks/TaskFormDialog";
import { STATUS_TABS, isOverdue } from "@/lib/tasks/taskStatus";
import type { Task } from "@/types/tasks";

type Filter = (typeof STATUS_TABS)[number]["key"];
const ALL_ASSIGNEES = "__all__";

const pill = (active: boolean) =>
  [
    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
  ].join(" ");

/** Cổng tập trung: mọi công việc từ mọi đối tượng về một chỗ. */
export default function AdminTasksPage() {
  const { data: tasks, isLoading } = useTasks();
  const { data: admins } = useAdminUsers();
  const del = useDeleteTask();
  const setStatus = useSetTaskStatus();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [assignee, setAssignee] = useState(ALL_ASSIGNEES);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const counts = useMemo(() => {
    const all = tasks ?? [];
    return {
      all: all.length,
      todo: all.filter((t) => t.status === "todo").length,
      in_progress: all.filter((t) => t.status === "in_progress").length,
      done: all.filter((t) => t.status === "done").length,
      cancelled: all.filter((t) => t.status === "cancelled").length,
      overdue: all.filter((t) => isOverdue(t.status, t.due_at)).length,
    } as Record<string, number>;
  }, [tasks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tasks ?? []).filter((t) => {
      if (filter === "overdue" && !isOverdue(t.status, t.due_at)) return false;
      if (filter !== "all" && filter !== "overdue" && t.status !== filter) return false;
      if (assignee !== ALL_ASSIGNEES && t.assignee_id !== assignee) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.code ?? "").toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [tasks, search, filter, assignee]);

  const handleComplete = async (t: Task) => {
    try {
      await setStatus.mutateAsync({ id: t.id, status: "done" });
      toast.success("Đã hoàn thành công việc");
    } catch {
      toast.error("Cập nhật thất bại");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del.mutateAsync(deleteTarget.id);
      toast.success("Đã xóa công việc");
    } catch {
      toast.error("Xóa thất bại");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Công việc</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {counts.all} công việc
            {counts.overdue > 0 && <span className="text-destructive"> · {counts.overdue} quá hạn</span>}
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo công việc
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
            placeholder="Tìm theo tên, mã, mô tả…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Người phụ trách" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ASSIGNEES}>Tất cả người phụ trách</SelectItem>
            {(admins ?? []).map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TaskTable
        tasks={filtered}
        isLoading={isLoading}
        onEdit={(t) => { setEditing(t); setDialogOpen(true); }}
        onComplete={handleComplete}
        onDelete={setDeleteTarget}
      />

      <TaskFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editing={editing} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa công việc?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.title}&quot; sẽ bị xóa. Hành động này không thể hoàn tác.
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
