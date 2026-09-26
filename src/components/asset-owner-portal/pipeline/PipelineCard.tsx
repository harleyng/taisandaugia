import { Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { moneyShortParts } from "@/utils/money";
import type { PipelineCard as PipelineCardData } from "@/lib/ownerPipeline";

const KIND_LABEL: Record<PipelineCardData["kind"], string> = {
  listing: "Tin đăng",
  posting: "Tài sản số hoá",
};

/**
 * Một tài sản trên bảng. Cả thẻ là MỘT nút mở chi tiết (không có nút lồng bên
 * trong). Màu trạng thái chỉ nằm ở ô số ngày, không tô cả thẻ (§A8.10).
 */
export function PipelineCard({ card }: { card: PipelineCardData }) {
  const navigate = useNavigate();
  const { value, unit } = moneyShortParts(card.price);
  const days = card.days === null ? null : card.days === 0 ? "Hôm nay" : `${card.days} ngày`;

  return (
    <button
      type="button"
      onClick={() => navigate(card.href)}
      className="relative w-full rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Badge
        variant="outline"
        className="rounded-full px-1.5 py-0 text-[11px] font-normal text-muted-foreground whitespace-nowrap"
      >
        {KIND_LABEL[card.kind]}
      </Badge>
      <p className="mt-1.5 line-clamp-2 text-sm font-medium text-foreground">{card.title}</p>
      {card.detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{card.detail}</p>}

      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">
            {card.priceKind === "winning" ? "Giá trúng" : "Khởi điểm"}
          </p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {value}
            {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
          </p>
        </div>
        {days && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs tabular-nums",
              card.overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
            )}
          >
            <Clock className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
            {days}
            {card.overdue && <span className="sr-only">, quá hạn</span>}
          </span>
        )}
      </div>
    </button>
  );
}
