// 5 nhóm trạng thái chung cho mọi loại yêu cầu dịch vụ. Trạng thái gốc của từng bảng
// vẫn hiển thị nguyên nhãn riêng; nhóm chỉ để lọc & đếm trên danh sách gộp.

export type ServiceGroupKey = "cho-bao-gia" | "cho-thanh-toan" | "dang-thuc-hien" | "hoan-tat" | "da-huy";

export const SERVICE_GROUPS: readonly { key: ServiceGroupKey; label: string; statuses: readonly string[] }[] = [
  { key: "cho-bao-gia", label: "Chờ báo giá", statuses: ["requested"] },
  { key: "cho-thanh-toan", label: "Chờ thanh toán", statuses: ["quoted"] },
  // VR "delivered" còn chờ sàn duyệt & gắn lô nên vẫn là việc đang làm.
  { key: "dang-thuc-hien", label: "Đang thực hiện", statuses: ["paid", "scheduled", "item_pending", "in_review", "in_progress", "delivered"] },
  { key: "hoan-tat", label: "Hoàn tất", statuses: ["completed", "attached", "superseded"] },
  { key: "da-huy", label: "Đã huỷ", statuses: ["cancelled"] },
];

export function serviceGroupOf(status: string): ServiceGroupKey | null {
  return SERVICE_GROUPS.find((g) => g.statuses.includes(status))?.key ?? null;
}

/** Màu badge theo trạng thái gốc — cùng một trạng thái có cùng ý nghĩa ở mọi loại. */
export const SERVICE_STATUS_TONE: Record<string, string> = {
  requested: "bg-warning/10 text-warning",
  quoted: "bg-accent/15 text-foreground",
  paid: "bg-primary/10 text-primary",
  scheduled: "bg-primary/10 text-primary",
  item_pending: "bg-primary/10 text-primary",
  in_review: "bg-warning/10 text-warning",
  in_progress: "bg-primary/10 text-primary",
  delivered: "bg-warning/10 text-warning",
  attached: "bg-success/10 text-success",
  completed: "bg-success/10 text-success",
  superseded: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};
