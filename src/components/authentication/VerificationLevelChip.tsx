import { ShieldCheck } from "lucide-react";
import { VERIFICATION_LEVEL_LABELS } from "@/lib/authentication/verificationLevel";

/** "Mức xác minh N/4" — giá trị dẫn xuất, xem lib/authentication/verificationLevel.ts. */
export function VerificationLevelChip({ level, className }: { level: number; className?: string }) {
  const strong = level >= 3;
  return (
    <span
      title={VERIFICATION_LEVEL_LABELS[level] ?? ""}
      className={[
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        strong ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
        className ?? "",
      ].join(" ")}
    >
      <ShieldCheck className="h-3 w-3" />
      Mức xác minh {level}/4
    </span>
  );
}
