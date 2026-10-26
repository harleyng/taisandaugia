import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { planStepSource, type PlanStepLike } from "@/lib/auctionPlan/steps";

const TONE = {
  success: "border-success/40 bg-success/10 text-foreground",
  primary: "border-primary/30 bg-primary/10 text-foreground",
  muted: "border-border bg-muted text-muted-foreground",
} as const;

const ICON_TONE = {
  success: "text-success",
  primary: "text-primary",
  muted: "text-muted-foreground",
} as const;

/**
 * Nhãn nguồn của một mốc ĐÃ XONG — cùng bộ từ với Trạm Điều Hành (§A3):
 * "Sàn xác nhận" (dữ liệu sàn) · "Có tài liệu" (tự khai kèm văn bản) ·
 * "Tự khai" (khai tay, chưa có văn bản). Mốc chưa xong không có nhãn.
 */
export function PlanStepSourceBadge({ step }: { step: PlanStepLike }) {
  const meta = planStepSource(step);
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
            TONE[meta.tone],
          )}
        >
          <Icon className={cn("h-3 w-3", ICON_TONE[meta.tone])} strokeWidth={1.5} aria-hidden="true" />
          {meta.label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{meta.hint}</TooltipContent>
    </Tooltip>
  );
}
