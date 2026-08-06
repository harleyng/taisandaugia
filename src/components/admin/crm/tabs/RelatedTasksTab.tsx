import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useRelatedTasks, useDeleteTask, useSetTaskStatus } from "@/hooks/useTasks";
import { TaskListView } from "@/components/admin/tasks/list/TaskListView";
import { TaskFormDialog } from "@/components/admin/tasks/TaskFormDialog";
import type { CrmRelation } from "@/lib/crm/relation";
import type { Task, TaskStatus } from "@/types/tasks";

/**
 * Tab "Công việc" nhúng trong trang chi tiết một đối tượng CRM. Tham số hóa
 * bằng quan hệ nên dùng lại được cho Lead / Khách hàng / Cơ hội / Đơn hàng.
 */
export function RelatedTasksTab({ relation }: { relation: Partial<CrmRelation> }) {
  const { data: tasks, isLoading } = useRelatedTasks(relation);
  const del = useDeleteTask();
  const setStatus = useSetTaskStatus();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);

  const openCreate = () => { setEditing(null); setDialogOpen(true); };

  const actions = {
    onEdit: (t: Task) => { setEditing(t); setDialogOpen(true); },
    onDelete: setDeleteTarget,
    onSetStatus: (t: Task, status: TaskStatus) => setStatus.mutate({ id: t.id, status }),
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
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm công việc
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : (tasks ?? []).length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">Chưa có công việc nào cho khách hàng này.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Tạo công việc đầu tiên
          </Button>
        </div>
      ) : (
        <TaskListView tasks={tasks ?? []} actions={actions} hideRelation pageSize={5} />
      )}

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        defaultRelation={relation}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa công việc?</AlertDialogTitle>
            <AlertDialogDescription>
              Công việc &quot;{deleteTarget?.title}&quot; sẽ bị xóa vĩnh viễn.
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
