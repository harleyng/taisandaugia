import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertTriangle, Clock } from "lucide-react";
import { formatPrice, formatDate } from "@/utils/formatters";
import type { PortfolioMetrics } from "@/hooks/useOwnerPortfolioMetrics";

interface Props {
  metrics: PortfolioMetrics;
}

export function ReportLayer4({ metrics }: Props) {
  // Upcoming registration deadlines within next 7 days
  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const urgentReg = metrics.allListings.filter((l) => {
    if (!l.registrationDeadline) return false;
    const d = new Date(l.registrationDeadline);
    return d >= now && d <= in7Days;
  });

  return (
    <div className="space-y-5">
      <h2 className="text-base font-bold text-foreground">Lớp 4 — Lịch & hành động</h2>

      {/* Upcoming sessions */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Lịch phiên đấu sắp tới</h3>
        </div>
        {metrics.upcomingSessions.length > 0 ? (
          <div className="space-y-3">
            {metrics.upcomingSessions.map((l) => (
              <div
                key={l.id}
                className="flex items-start justify-between gap-4 pb-3 border-b border-border/50 last:border-none last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground line-clamp-1">{l.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {l.auctionOrgName ?? "—"} · {l.province}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">
                    {formatPrice(l.price, l.priceUnit)}
                  </p>
                  {l.auctionTime && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(l.auctionTime)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Không có phiên đấu sắp tới trong tổ hợp này.
          </p>
        )}
      </Card>

      {/* Urgent registration deadlines */}
      {urgentReg.length > 0 && (
        <Card className="p-5 border-warning/30 bg-warning/5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">
              Hạn đăng ký sắp hết (trong 7 ngày)
            </h3>
          </div>
          <div className="space-y-2">
            {urgentReg.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-4 text-sm">
                <span className="text-foreground line-clamp-1 flex-1">{l.title}</span>
                <Badge variant="outline" className="shrink-0 border-warning text-warning">
                  {l.registrationDeadline ? formatDate(l.registrationDeadline) : "—"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Action list — pending assets */}
      {metrics.pendingAssets.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Tài sản cần xử lý ưu tiên</h3>
          </div>
          <div className="space-y-2">
            {metrics.pendingAssets.slice(0, 8).map((l) => (
              <div key={l.id} className="flex items-start justify-between gap-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-foreground line-clamp-1 font-medium">{l.title}</p>
                  <p className="text-xs text-muted-foreground">Đã đấu {l.roundCount} lần · {l.province}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {formatPrice(l.price, l.priceUnit)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
