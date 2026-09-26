import { AlertTriangle, CheckCheck, CircleDashed, PenLine, ShieldCheck, type LucideIcon } from "lucide-react";
import { badgeVariants } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatMoneyFull } from "@/utils/money";
import { formatDateISO } from "@/utils/formatters";
import {
  OUTCOME_CONFIDENCE_META,
  OUTCOME_KIND_LABEL,
  describeOutcomeSource,
  type OutcomeConfidence,
  type OutcomeSourceEntry,
} from "@/lib/ownerOutcomes";

// Icon theo §A8.5; màu chỉ ở icon + viền nhạt, chữ giữ màu thường cho đủ tương phản.
const STYLE: Record<OutcomeConfidence, { icon: LucideIcon; chip: string; iconClass: string }> = {
  platform:       { icon: ShieldCheck,  chip: "border-success/30 bg-success/10 text-foreground", iconClass: "text-success" },
  reconciled:     { icon: CheckCheck,   chip: "border-success/30 bg-success/10 text-foreground", iconClass: "text-success" },
  owner_evidence: { icon: PenLine,      chip: "border-border text-muted-foreground",            iconClass: "" },
  self_reported:  { icon: PenLine,      chip: "border-border text-muted-foreground",            iconClass: "" },
  estimated:      { icon: CircleDashed, chip: "border-border text-muted-foreground",            iconClass: "" },
};

const CHIP = "gap-1 whitespace-nowrap px-1.5 py-0 text-[11px] font-medium leading-5";

function sourceValue(s: OutcomeSourceEntry): string {
  if (s.outcome === "sold") return s.price !== null ? formatMoneyFull(s.price) : OUTCOME_KIND_LABEL.sold;
  return s.outcome ? OUTCOME_KIND_LABEL[s.outcome] : "—";
}

interface OutcomeSourceBadgeProps {
  confidence: OutcomeConfidence;
  /** Theo hạng, phần tử đầu là nguồn thắng — để tooltip nói rõ ai khai và liệt kê khi lệch. */
  sources?: OutcomeSourceEntry[];
  hasConflict?: boolean;
  className?: string;
}

/** Nhãn nguồn của một con số kết quả phiên (§A3) + chip "Lệch số liệu" khi các nguồn không khớp. */
export function OutcomeSourceBadge({ confidence, sources = [], hasConflict = false, className }: OutcomeSourceBadgeProps) {
  const meta = OUTCOME_CONFIDENCE_META[confidence];
  const { icon: Icon, chip, iconClass } = STYLE[confidence];
  const winner = sources[0];
  const winnerText = describeOutcomeSource(winner);
  const winnerDate = winner?.date ? formatDateISO(winner.date) : null;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Nguồn số liệu: ${meta.label}`}
            className={cn(badgeVariants({ variant: "outline" }), CHIP, chip)}
          >
            <Icon className={cn("h-3 w-3 shrink-0", iconClass)} strokeWidth={1.5} aria-hidden="true" />
            {meta.label}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 text-xs leading-relaxed">
          {winnerText && <p className="font-medium">{winnerText}</p>}
          {winnerDate && <p>Ngày: {winnerDate}</p>}
          <p className="text-muted-foreground">{meta.description}</p>
        </TooltipContent>
      </Tooltip>

      {hasConflict && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Lệch số liệu giữa các nguồn"
              className={cn(badgeVariants({ variant: "outline" }), CHIP, "border-warning/40 bg-warning/10 text-foreground")}
            >
              <AlertTriangle className="h-3 w-3 shrink-0 text-warning" strokeWidth={1.5} aria-hidden="true" />
              Lệch số liệu
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs space-y-1 text-xs leading-relaxed">
            <p className="font-medium">Các nguồn không khớp nhau</p>
            <ul className="space-y-0.5">
              {sources.map((s, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{describeOutcomeSource(s) ?? "Nguồn khác"}</span>
                  <span className="shrink-0 tabular-nums">{sourceValue(s)}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground">Đang hiển thị số của nguồn đáng tin nhất.</p>
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}
