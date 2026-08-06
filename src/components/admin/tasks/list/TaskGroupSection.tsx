import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ListPager } from "@/components/admin/crm/ListPager";
import { usePager } from "@/hooks/usePager";
import { TaskRowCard, type TaskActions } from "./TaskRowCard";
import type { Task } from "@/types/tasks";

// Nhóm không phân trang thì vẫn phải gọi usePager (thứ tự hook cố định) —
// kích thước "vô hạn" này chỉ để nó trả về nguyên danh sách.
const NO_PAGING = Number.MAX_SAFE_INTEGER;

/** Một nhóm gập được (Quá hạn xử lý / Hôm nay / Sắp tới / Đã đóng). */
export function TaskGroupSection({
  title,
  tasks,
  actions,
  accent,
  defaultOpen = true,
  hideRelation,
  pageSize,
}: {
  title: string;
  tasks: Task[];
  actions: TaskActions;
  accent?: boolean;
  defaultOpen?: boolean;
  hideRelation?: boolean;
  /** Bật phân trang trong nhóm (panel nhúng ở trang chi tiết). */
  pageSize?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const { paged, pager } = usePager(tasks, pageSize ?? NO_PAGING);

  if (tasks.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-2xl border border-border bg-card">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-3">
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium ${
            accent ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {tasks.length}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 px-3 pb-3">
        {paged.map((t) => (
          <TaskRowCard key={t.id} task={t} actions={actions} hideRelation={hideRelation} />
        ))}
        {!!pageSize && <ListPager pager={pager} />}
      </CollapsibleContent>
    </Collapsible>
  );
}