import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { Building2, FileText, Coins, Clock, Wallet } from "lucide-react";
import { formatVnd } from "@/lib/advertising/slug";
import { isOverdue, REVENUE_MODE_LABELS } from "@/lib/opportunities/opportunityStage";
import type { Opportunity } from "@/types/opportunities";

interface Props {
  opportunity: Opportunity;
  onOpen: (o: Opportunity) => void;
  /** Bản sao đang bay theo con trỏ trong DragOverlay — bỏ hook kéo, giữ nguyên style. */
  overlay?: boolean;
}

/** Thẻ cơ hội trên bảng: tên · chủ thể · số tiền · hạn chốt (đỏ khi quá hạn). */
export function OpportunityCard({ opportunity: o, onOpen, overlay }: Props) {
  const sortable = useSortable({ id: o.id, disabled: overlay });
  const overdue = isOverdue(o.stage, o.expected_close_at);
  const owner = o.customer?.name ?? o.lead?.name ?? "—";

  const style = overlay
    ? undefined
    : {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.4 : 1,
      };

  return (
    <div
      ref={overlay ? undefined : sortable.setNodeRef}
      style={style}
      {...(overlay ? {} : sortable.attributes)}
      {...(overlay ? {} : sortable.listeners)}
      onClick={() => !overlay && onOpen(o)}
      className={`rounded-lg border bg-card p-3 space-y-2 cursor-grab active:cursor-grabbing ${
        overlay ? "border-primary shadow-lg" : "border-border hover:border-primary/40 transition-colors"
      }`}
    >
      <div className="flex items-start gap-2">
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <span className="text-sm font-medium text-foreground leading-tight">{o.name}</span>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Building2 className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{owner}</span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <Coins className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-semibold tabular-nums text-foreground">{formatVnd(o.amount)}</span>
        {o.service_kind === "commission" && (
          <span className="text-[10px] text-muted-foreground">
            / {formatVnd(o.gross_amount)} HĐ
          </span>
        )}
      </div>

      {o.expected_close_at && (
        <div className={`flex items-center gap-2 text-xs ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>Hết hạn: {format(new Date(o.expected_close_at), "dd/MM/yyyy HH:mm")}</span>
        </div>
      )}

      {/* Cơ hội bán gói credit: cố ý KHÔNG sinh đơn — nói rõ để khoảng lệch
          dự kiến ↔ thực nạp là hữu hình, không im lặng. */}
      {o.stage === "won" && o.revenue_mode === "credit_ledger" && (
        <div className="flex items-center gap-2 text-xs text-amber-700">
          <Wallet className="h-3.5 w-3.5 shrink-0" />
          <span>{REVENUE_MODE_LABELS.credit_ledger}</span>
        </div>
      )}

      <span className="block font-mono text-[10px] text-muted-foreground/70">{o.code}</span>
    </div>
  );
}
