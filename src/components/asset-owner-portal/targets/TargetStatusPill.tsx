import { cn } from "@/lib/utils";
import { TARGET_PILL_LABEL, type TargetPillKind } from "@/lib/ownerTargetView";

// "Đang thực hiện" của bản thiết kế là xanh dương — không có token ⇒ sắc trung tính.
const TONE: Record<TargetPillKind, string> = {
  upcoming: "bg-muted text-muted-foreground",
  running: "bg-foreground/[0.07] text-foreground",
  met: "bg-primary/10 text-primary",
  missed: "bg-destructive/10 text-destructive",
};

/** "● Đang thực hiện" · "● Đạt" · "● Không đạt" · "● Sắp tới". */
export function TargetStatusPill({ kind }: { kind: TargetPillKind }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] py-0.5 text-xs font-semibold",
        TONE[kind],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {TARGET_PILL_LABEL[kind]}
    </span>
  );
}
