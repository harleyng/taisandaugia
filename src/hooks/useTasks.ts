import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RELATION_SELECT, type CrmRelation } from "@/lib/crm/relation";
import type { Task, TaskUpsert } from "@/types/tasks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tasksTable = () => (supabase as any).from("tasks");

// Embed cả 4 quan hệ trong MỘT select — đúng thứ cổng tập trung cần.
const TASK_SELECT = `*, assignee:profiles(id,name,email), ${RELATION_SELECT}`;

// ─── Reads ───────────────────────────────────────────────────────────────────

export function useTasks() {
  return useQuery<Task[]>({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await tasksTable()
        .select(TASK_SELECT)
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });
}

/** Công việc của một đối tượng — dùng cho panel nhúng ở trang chi tiết. */
export function useRelatedTasks(relation: Partial<CrmRelation>) {
  const [column, value] = Object.entries(relation).find(([, v]) => !!v) ?? [];
  return useQuery<Task[]>({
    queryKey: ["tasks", "by-relation", column, value],
    queryFn: async () => {
      const { data, error } = await tasksTable()
        .select(TASK_SELECT)
        .eq(column as string, value)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
    enabled: !!column && !!value,
  });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["tasks"] });
}

export function useUpsertTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: TaskUpsert) => {
      if (id) {
        const { data, error } = await tasksTable().update(payload).eq("id", id).select().single();
        if (error) throw error;
        return data as Task;
      }
      const { data, error } = await tasksTable().insert(payload).select().single();
      if (error) throw error;
      return data as Task;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await tasksTable().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
}

/** Đổi trạng thái nhanh từ danh sách (tick hoàn thành). Cập nhật lạc quan. */
export function useSetTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Task["status"] }) => {
      const { error } = await tasksTable().update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["tasks"] });
      const snapshot = qc.getQueriesData<Task[]>({ queryKey: ["tasks"] });
      qc.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, status } : t)),
      );
      return { snapshot };
    },
    onError: (_e, _v, ctx) => {
      ctx?.snapshot?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => invalidate(qc),
  });
}
