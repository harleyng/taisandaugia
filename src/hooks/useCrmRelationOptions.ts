import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmRelationKind } from "@/lib/crm/relation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string) => (supabase as any).from(name);

/** Một lựa chọn để gắn công việc/ticket. `label` đã gộp sẵn phần hiển thị. */
export interface CrmRelationOption {
  id: string;
  code: string | null;
  label: string;
}

interface Source {
  table: string;
  select: string;
  orderBy: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toLabel: (row: any) => string;
}

// Chỉ lấy đúng 3 cột cần cho picker — KHÔNG tái dùng useLeads/useCustomers/…
// vì chúng kéo full row kèm embed, và sẽ nạp cả 4 danh sách dù chỉ cần 1.
const SOURCES: Record<CrmRelationKind, Source> = {
  lead: {
    table: "leads",
    select: "id, code, name",
    orderBy: "created_at",
    toLabel: (r) => r.name ?? "—",
  },
  customer: {
    table: "customers",
    select: "id, code, name",
    orderBy: "created_at",
    toLabel: (r) => r.name ?? "—",
  },
  opportunity: {
    table: "opportunities",
    select: "id, code, name",
    orderBy: "created_at",
    toLabel: (r) => r.name ?? "—",
  },
  // Đơn hàng không có cột `name` — dựng nhãn từ mã + tên khách hàng.
  order: {
    table: "orders",
    select: "id, code, customer:customers(name)",
    orderBy: "ordered_at",
    toLabel: (r) => [r.code, r.customer?.name].filter(Boolean).join(" · ") || "Đơn hàng",
  },
};

/** Danh sách đối tượng của MỘT loại — chỉ query khi người dùng đã chọn loại. */
export function useCrmRelationOptions(kind: CrmRelationKind | null) {
  return useQuery<CrmRelationOption[]>({
    queryKey: ["crm-relation-options", kind],
    queryFn: async () => {
      const src = SOURCES[kind as CrmRelationKind];
      const { data, error } = await table(src.table)
        .select(src.select)
        .order(src.orderBy, { ascending: false })
        .limit(300);
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((r: any) => ({
        id: r.id as string,
        code: (r.code ?? null) as string | null,
        label: src.toLabel(r),
      }));
    },
    enabled: !!kind,
  });
}
