import { useEffect, useMemo, useState } from "react";
import { Plus, Search, User } from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";
import { TaskFormDialog } from "@/components/admin/tasks/TaskFormDialog";
import { TaskViewSwitcher } from "@/components/admin/tasks/TaskViewSwitcher";
import { TaskDateNavigator } from "@/components/admin/tasks/TaskDateNavigator";
import { TaskListView } from "@/components/admin/tasks/list/TaskListView";
import { TaskAgendaView } from "@/components/admin/tasks/calendar/TaskAgendaView";
import { TaskWeekView } from "@/components/admin/tasks/calendar/TaskWeekView";
import { TaskMonthView } from "@/components/admin/tasks/calendar/TaskMonthView";
import type { TaskActions } from "@/components/admin/tasks/list/TaskRowCard";
import { STATUS_TABS, isOverdue } from "@/lib/tasks/taskStatus";
import type { TaskView } from "@/lib/tasks/taskBuckets";
import type { Task, TaskStatus } from "@/types/tasks";

type Filter = (typeof STATUS_TABS)[number]["key"];
const ALL_ASSIGNEES = "__all__";
const VIEW_KEY = "admin-tasks-view";

const pill = (active: boolean) =>
  [
    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
  ].join(" ");

/** Cổng tập trung: mọi công việc từ mọi đối tượng về một chỗ. */
export default function AdminTasksPage() {
  const { userId } = useAuth();
  const { data: tasks, isLoading } = useTasks();
  const { data: admins } = useAdminUsers();
  const del = useDeleteTask();
  const setStatus = useSetTaskStatus();

  const [view, setView] = useState<TaskView>(
    () => (localStorage.getItem(VIEW_KEY) as TaskView) || "list",
  );
  const [cursor, setCursor] = useState(() => new Date());
  const [myTasks, setMyTasks] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [assignee, setAssignee] = useState(ALL_ASSIGNEES);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  useEffect(() => localStorage.setItem(VIEW_KEY, view), [view]);

  // Lọc theo phạm vi (của tôi / người phụ trách / tìm kiếm) — chưa áp tab trạng thái.
  const scoped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const effAssignee = myTasks ? userId : assignee === ALL_ASSIGNEES ? null : assignee;
    return (tasks ?? []).filter((t) => {
      if (effAssignee && t.assignee_id !== effAssignee) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        (t.code ?? "").toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [tasks, search, assignee, myTasks, userId]);

  const counts = useMemo(() => {
    return {
      all: scoped.length,
      todo: scoped.filter((t) => t.status === "todo").length,
      in_progress: scoped.filter((t) => t.status === "in_progress").length,
      done: scoped.filter((t) => t.status === "done").length,
      cancelled: scoped.filter((t) => t.status === "cancelled").length,
      overdue: scoped.filter((t) => isOverdue(t.status, t.due_at)).length,
    } as Record<string, number>;
  }, [scoped]);

  const filtered = useMemo(
    () => (filter === "all" ? scoped : scoped.filter((t) => t.status === filter)),
    [scoped, filter],
  );

  const handleSetStatus = async (t: Task, status: TaskStatus) => {
    try {
      await setStatus.mutateAsync({ id: t.id, status });
      toast.success("Đã cập nhật trạng thái");
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

  const actions: TaskActions = {
    onEdit: (t) => { setEditing(t); setDialogOpen(true); },
    onDelete: setDeleteTarget,
    onSetStatus: handleSetStatus,
  };

  const showNavigator = view === "week" || view === "month";
  const isEmpty = !isLoading && filtered.length === 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Công việc</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {counts.all} công việc
            {counts.overdue > 0 && <span className="text-destructive"> · {counts.overdue} quá hạn</span>}
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="mr-1.5 h-4 w-4" />
          Tạo công việc
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <TaskViewSwitcher view={view} onChange={setView} />
        {showNavigator && <TaskDateNavigator view={view} cursor={cursor} onChange={setCursor} />}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={myTasks ? "default" : "outline"}
          onClick={() => setMyTasks((v) => !v)}
        >
          <User className="mr-1.5 h-4 w-4" />
          Của tôi
        </Button>
        <div className="flex flex-wrap items-center gap-1">
          {STATUS_TABS.map((t) => (
            <button key={t.key} className={pill(filter === t.key)} onClick={() => setFilter(t.key)}>
              {t.label} <span className="text-xs opacity-70">({counts[t.key] ?? 0})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên, mã, mô tả…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={assignee} onValueChange={setAssignee} disabled={myTasks}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Người phụ trách" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ASSIGNEES}>Tất cả người phụ trách</SelectItem>
            {(admins ?? []).map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          Đang tải…
        </div>
      ) : isEmpty ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          {myTasks ? "Chưa có công việc nào của bạn — tắt \"Của tôi\" để xem tất cả." : "Chưa có công việc nào."}
        </div>
      ) : view === "list" ? (
        <TaskListView tasks={filtered} actions={actions} />
      ) : view === "agenda" ? (
        <TaskAgendaView tasks={filtered} actions={actions} />
      ) : view === "week" ? (
        <TaskWeekView tasks={filtered} cursor={cursor} actions={actions} />
      ) : (
        <TaskMonthView tasks={filtered} cursor={cursor} actions={actions} />
      )}

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
