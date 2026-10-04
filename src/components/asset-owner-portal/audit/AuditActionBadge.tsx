import { cn } from "@/lib/utils";
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/ownerAudit";

/** Sắc thái theo nhóm thao tác: tạo (xanh), sửa (chính), xoá (đỏ), xem / đăng nhập (xám), xuất / chia sẻ (vàng). */
const TONE: Record<AuditAction, string> = {
  create: "bg-success/10 text-success",
  update: "bg-primary/10 text-primary",
  delete: "bg-destructive/10 text-destructive",
  view: "bg-muted text-muted-foreground",
  login: "bg-muted text-muted-foreground",
  logout: "bg-muted text-muted-foreground",
  export: "bg-warning/15 text-foreground",
  print: "bg-warning/15 text-foreground",
  share: "bg-warning/15 text-foreground",
  download: "bg-warning/15 text-foreground",
};

export function AuditActionBadge({ action, className }: { action: AuditAction; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11.5px] font-medium leading-4",
        TONE[action],
        className,
      )}
    >
      {AUDIT_ACTION_LABELS[action]}
    </span>
  );
}
