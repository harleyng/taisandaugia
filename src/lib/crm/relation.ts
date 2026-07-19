// Quan hệ CRM dùng chung cho Công việc và Ticket.
//
// DB gắn đối tượng bằng 4 CỘT FK NULLABLE + CHECK num_nonnulls(...) <= 1, chứ
// không phải polymorphic (related_type + related_id): giữ được toàn vẹn tham
// chiếu thật và PostgREST embed cả 4 quan hệ trong MỘT select.
//
// Cố ý KHÔNG có cột `related_kind` GENERATED ở DB — đổi biểu thức generated
// column là rewrite cả bảng. Suy ra ở đây.

export type CrmRelationKind = "lead" | "customer" | "opportunity" | "order";

/** 4 cột FK trên tasks/tickets. */
export interface CrmRelation {
  lead_id: string | null;
  customer_id: string | null;
  opportunity_id: string | null;
  order_id: string | null;
}

/** Hàng đã hydrate kèm quan hệ embed. */
export interface CrmRelated extends CrmRelation {
  lead?: { id: string; code: string | null; name: string } | null;
  customer?: { id: string; code: string | null; name: string } | null;
  opportunity?: { id: string; code: string | null; name: string } | null;
  order?: { id: string; code: string | null } | null;
}

export const RELATION_LABELS: Record<CrmRelationKind, string> = {
  lead: "Khách tiềm năng",
  customer: "Khách hàng",
  opportunity: "Cơ hội",
  order: "Đơn hàng",
};

export const RELATION_BADGE_CLASS: Record<CrmRelationKind, string> = {
  lead: "bg-violet-100 text-violet-700",
  customer: "bg-blue-100 text-blue-700",
  opportunity: "bg-emerald-100 text-emerald-700",
  order: "bg-amber-100 text-amber-700",
};

/** Đường dẫn tới trang của đối tượng — dùng cho link ở cổng tập trung. */
export const RELATION_PATH: Record<CrmRelationKind, string> = {
  lead: "/admin/khach-hang-tiem-nang",
  customer: "/admin/khach-hang",
  opportunity: "/admin/co-hoi",
  order: "/admin/don-hang",
};

export interface ResolvedRelation {
  kind: CrmRelationKind;
  id: string;
  label: string;
  code: string | null;
}

/** Suy ra quan hệ duy nhất (nếu có) của một công việc/ticket. */
export function resolveRelation(row: CrmRelated): ResolvedRelation | null {
  if (row.lead_id) {
    return { kind: "lead", id: row.lead_id, label: row.lead?.name ?? "—", code: row.lead?.code ?? null };
  }
  if (row.customer_id) {
    return { kind: "customer", id: row.customer_id, label: row.customer?.name ?? "—", code: row.customer?.code ?? null };
  }
  if (row.opportunity_id) {
    return { kind: "opportunity", id: row.opportunity_id, label: row.opportunity?.name ?? "—", code: row.opportunity?.code ?? null };
  }
  if (row.order_id) {
    return { kind: "order", id: row.order_id, label: row.order?.code ?? "Đơn hàng", code: row.order?.code ?? null };
  }
  return null;
}

/** Dựng payload 4 cột từ một quan hệ — đảm bảo chỉ đúng một cột có giá trị. */
export function relationPayload(rel: { kind: CrmRelationKind; id: string } | null): CrmRelation {
  const base: CrmRelation = { lead_id: null, customer_id: null, opportunity_id: null, order_id: null };
  if (!rel) return base;
  return { ...base, [`${rel.kind === "opportunity" ? "opportunity" : rel.kind}_id`]: rel.id };
}

/** Select string embed cả 4 quan hệ — đúng thứ cổng tập trung cần trong 1 query. */
export const RELATION_SELECT =
  "lead:leads(id,code,name), customer:customers(id,code,name), " +
  "opportunity:opportunities(id,code,name), order:orders(id,code)";
