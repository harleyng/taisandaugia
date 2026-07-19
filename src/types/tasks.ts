// Công việc (tasks) — gắn được vào Lead / Khách hàng / Cơ hội / Đơn hàng,
// hoặc đứng độc lập (việc nhắc nội bộ).

import type { CrmRelation, CrmRelated } from "@/lib/crm/relation";

export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskType = "call" | "email" | "meeting" | "followup" | "other";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface Task extends CrmRelated {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  task_type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  closed_at: string | null;
  assignee_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  assignee?: { id: string; name: string | null; email: string } | null;
}

/** Payload ghi công việc. `closed_at` do trigger tasks_sync_closed dẫn xuất. */
export interface TaskUpsert extends Partial<CrmRelation> {
  id?: string;
  title: string;
  description?: string | null;
  task_type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  due_at?: string | null;
  assignee_id?: string | null;
}
