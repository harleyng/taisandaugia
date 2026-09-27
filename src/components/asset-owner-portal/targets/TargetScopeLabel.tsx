import { cn } from "@/lib/utils";

interface TargetScopeLabelProps {
  label: string;
  /** Chỉ tiêu của một chi nhánh: ô vuông rỗng; cả đơn vị: ô vuông đặc. */
  branch: boolean;
  className?: string;
}

/** "■ Toàn đơn vị" · "□ Chi nhánh Quận 7". */
export function TargetScopeLabel({ label, branch, className }: TargetScopeLabelProps) {
  return (
    <span className={cn("flex min-w-0 items-center gap-[7px] text-[13px]", className)}>
      <i
        aria-hidden="true"
        className={cn(
          "h-2 w-2 shrink-0 rounded-[2px]",
          branch ? "shadow-[inset_0_0_0_1.5px_hsl(var(--muted-foreground))]" : "bg-foreground",
        )}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}
