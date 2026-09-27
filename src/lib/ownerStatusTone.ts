// Sắc thái của nhãn trạng thái trong cổng chủ tài sản (thiết kế "Số hoá tài sản" /
// "Ký gửi đấu giá"): chấm tròn màu + chữ. Màu chỉ nằm ở CHẤM — chữ vàng nhỏ trên
// nền sáng không đủ tương phản, nên việc của chủ tài sản ("me") là chữ thường +
// chấm vàng.

/** me = việc của chủ tài sản · wait = đang chờ bên khác · err = cần xử lý gấp / bị trả lại. */
export type OwnerStatusTone = "draft" | "wait" | "me" | "err" | "ok";

export const OWNER_TONE_DOT: Record<OwnerStatusTone, string> = {
  draft: "bg-muted-foreground/50",
  wait: "bg-foreground/45",
  me: "bg-warning",
  err: "bg-destructive",
  ok: "bg-success",
};

export const OWNER_TONE_TEXT: Record<OwnerStatusTone, string> = {
  draft: "text-muted-foreground",
  wait: "text-foreground/70",
  me: "text-foreground",
  err: "text-destructive",
  ok: "text-success",
};
