import { Badge } from "@/components/ui/badge";
import { SALE_STAGE_LABELS, type SaleStage } from "@/types/auction-sale-contract";
import { cn } from "@/lib/utils";

/** Màu lấy từ token — tuyệt đối không thêm mã màu mới. */
const VARIANT: Record<SaleStage, string> = {
  signing: "bg-muted text-muted-foreground",
  paying: "bg-accent/15 text-accent-foreground border-accent/40",
  handover: "bg-primary/10 text-primary border-primary/30",
  completed: "bg-success/10 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

export function SaleStageBadge({
  stage,
  overdue = false,
  className,
}: {
  stage: SaleStage;
  /** Quá hạn chỉ là cảnh báo — không đổi giai đoạn, chỉ thêm dấu. */
  overdue?: boolean;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("font-medium", VARIANT[stage], className)}>
      {SALE_STAGE_LABELS[stage]}
      {overdue ? " · quá hạn" : ""}
    </Badge>
  );
}
