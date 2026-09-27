import { cn } from "@/lib/utils";
import { OUTCOME_CONFIDENCE_META, type OutcomeConfidence } from "@/lib/ownerOutcomes";

/**
 * Chấm màu theo độ tin của nguồn (design "Kết quả phiên"): đậm dần từ tự khai tới
 * sàn xác nhận. Chỉ dùng token sẵn có — sàn = primary, đối chiếu = primary nhạt,
 * có biên bản / tự khai / ước tính = thang xám.
 */
const CONFIDENCE_DOT: Record<OutcomeConfidence, string> = {
  platform: "bg-primary",
  reconciled: "bg-primary/50",
  owner_evidence: "bg-muted-foreground",
  self_reported: "bg-muted-foreground/40",
  estimated: "bg-muted-foreground/20",
};

export function Dot({ confidence, className }: { confidence: OutcomeConfidence | null; className?: string }) {
  return (
    <i
      aria-hidden="true"
      className={cn(
        "block h-2 w-2 shrink-0 rounded-full",
        confidence ? CONFIDENCE_DOT[confidence] : "bg-border",
        className,
      )}
    />
  );
}

/** Chấm + nhãn nguồn, VD "● Sàn xác nhận". */
export function SourceDot({ confidence }: { confidence: OutcomeConfidence | null }) {
  return (
    <span className="flex items-center gap-[7px] text-[12.5px] text-muted-foreground">
      <Dot confidence={confidence} />
      {confidence ? OUTCOME_CONFIDENCE_META[confidence].label : "Chưa rõ nguồn"}
    </span>
  );
}
