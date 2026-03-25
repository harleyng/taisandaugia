import { Card } from "@/components/ui/card";
import { Clock, FileText, Eye, Gavel } from "lucide-react";

interface AuctionScheduleInfoProps {
  listing: any;
}

const formatDateTime = (dateStr: string | undefined) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateRange = (start: string | undefined, end: string | undefined) => {
  const startFmt = formatDateTime(start);
  const endFmt = formatDateTime(end);
  if (!startFmt && !endFmt) return null;
  if (startFmt && endFmt) return `${startFmt} → ${endFmt}`;
  return startFmt || endFmt;
};

export const AuctionScheduleInfo = ({ listing }: AuctionScheduleInfoProps) => {
  const ca = listing.custom_attributes || {};
  
  const hasSchedule = ca.document_sale_start || ca.document_sale_end || 
                      ca.asset_viewing_start || ca.asset_viewing_end || 
                      ca.auction_time || ca.auction_date;
  
  if (!hasSchedule) return null;

  const scheduleItems = [
    {
      icon: FileText,
      label: "Thời gian bán hồ sơ",
      value: formatDateRange(ca.document_sale_start, ca.document_sale_end),
    },
    {
      icon: Eye,
      label: "Thời gian xem tài sản",
      value: formatDateRange(ca.asset_viewing_start, ca.asset_viewing_end),
    },
    {
      icon: Gavel,
      label: "Thời gian đấu giá",
      value: formatDateTime(ca.auction_time || ca.auction_date),
    },
  ].filter(item => item.value);

  if (scheduleItems.length === 0) return null;

  return (
    <Card className="p-5 space-y-4">
      {/* Header với icon */}
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold text-foreground">Lịch trình đấu giá</h3>
      </div>

      <div className="space-y-3">
        {scheduleItems.map((item, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
              <item.icon className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-medium text-foreground">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
