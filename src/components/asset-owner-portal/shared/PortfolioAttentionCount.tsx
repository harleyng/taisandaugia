import { Card } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

interface Props {
  count: number;
}

export function PortfolioAttentionCount({ count }: Props) {
  if (count === 0) return null;

  return (
    <Card className="p-4 border-warning/40 bg-warning/5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-warning/15 shrink-0">
          <AlertTriangle className="w-4 h-4 text-warning" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {count} tài sản cần chú ý
          </p>
          <p className="text-xs text-muted-foreground">
            Đã đấu từ 2 lần trở lên nhưng chưa thành — xem báo cáo để phân tích chi tiết
          </p>
        </div>
      </div>
    </Card>
  );
}
