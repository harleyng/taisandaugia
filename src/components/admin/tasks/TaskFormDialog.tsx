import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useUpsertTask } from "@/hooks/useTasks";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import {
  STATUS_LABELS, TYPE_LABELS, PRIORITY_LABELS,
} from "@/lib/tasks/taskStatus";
import { RelationPicker } from "@/components/admin/crm/RelationPicker";
import {
  relationFromPartial, relationPayload, resolveRelation,
  type CrmRelation, type ResolvedRelation,
} from "@/lib/crm/relation";
import type { Task, TaskStatus, TaskType, TaskPriority } from "@/types/tasks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Task | null;
  /** Gắn sẵn đối tượng khi tạo từ panel trong trang chi tiết. */
  defaultRelation?: Partial<CrmRelation>;
}

const NO_ASSIGNEE = "__none__";

const empty = () => ({
  title: "",
  description: "",
  task_type: "call" as TaskType,
  status: "todo" as TaskStatus,
  priority: "normal" as TaskPriority,
  due_at: format(new Date(Date.now() + 3 * 86400000), "yyyy-MM-dd"),
  assignee_id: NO_ASSIGNEE,
});

export function TaskFormDialog({ open, onOpenChange, editing, defaultRelation }: Props) {
  const upsert = useUpsertTask();
  const { data: admins } = useAdminUsers();
  const [form, setForm] = useState(empty());
  const [relation, setRelation] = useState<ResolvedRelation | null>(null);

  // Call site truyền object literal (`{ lead_id: id }`) nên định danh đổi mỗi
  // lần cha render — so sánh bằng khóa chuỗi để không reset form đang nhập dở.
  const relationKey = JSON.stringify(defaultRelation ?? null);

  useEffect(() => {
    if (!open) return;
    setRelation(editing ? resolveRelation(editing) : relationFromPartial(JSON.parse(relationKey) ?? undefined));
    if (editing) {
      setForm({
        title: editing.title,
        description: editing.description ?? "",
        task_type: editing.task_type,
        status: editing.status,
        priority: editing.priority,
        due_at: editing.due_at ? format(new Date(editing.due_at), "yyyy-MM-dd") : "",
        assignee_id: editing.assignee_id ?? NO_ASSIGNEE,
      });
    } else {
      setForm(empty());
    }
  }, [open, editing, relationKey]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (form.title.trim().length < 2) return toast.error("Vui lòng nhập tên công việc");
    if (relation && !relation.id) return toast.error("Vui lòng chọn đối tượng liên quan");
    try {
      await upsert.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        // Gửi cả 4 cột ở mọi lần lưu — đổi hoặc gỡ đối tượng đều ghi được.
        ...relationPayload(relation),
        title: form.title.trim(),
        description: form.description.trim() || null,
        task_type: form.task_type,
        status: form.status,
        priority: form.priority,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        assignee_id: form.assignee_id === NO_ASSIGNEE ? null : form.assignee_id,
      });
      toast.success(editing ? "Đã cập nhật công việc" : "Đã tạo công việc");
      onOpenChange(false);
    } catch {
      toast.error("Lưu thất bại");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa công việc" : "Tạo công việc"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Tên công việc <span className="text-destructive">*</span></Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Gọi điện xác nhận nhu cầu" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Loại</Label>
              <Select value={form.task_type} onValueChange={(v) => set("task_type", v as TaskType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as TaskType[]).map((k) => (
                    <SelectItem key={k} value={k}>{TYPE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ưu tiên</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((k) => (
                    <SelectItem key={k} value={k}>{PRIORITY_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Hạn hoàn thành</Label>
              <Input type="date" value={form.due_at} onChange={(e) => set("due_at", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Trạng thái</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((k) => (
                    <SelectItem key={k} value={k}>{STATUS_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <RelationPicker value={relation} onChange={setRelation} />

          <div className="space-y-1.5">
            <Label>Người phụ trách</Label>
            <Select value={form.assignee_id} onValueChange={(v) => set("assignee_id", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ASSIGNEE}>Chưa giao</SelectItem>
                {(admins ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Mô tả</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={submit} disabled={upsert.isPending}>{editing ? "Lưu" : "Tạo"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
