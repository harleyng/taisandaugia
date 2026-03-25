import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

interface AuctionInfoTableProps {
  listing: any;
}

const formatDateRange = (start: string | undefined, end: string | undefined) => {
  if (!start || !end) return null;
  const fmt = (d: Date) =>
    d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
  return `${fmt(new Date(start))} → ${fmt(new Date(end))}`;
};

const formatSingleDate = (dateStr: string | undefined) => {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleString("vi-VN", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric",
  });
};

export const AuctionInfoTable = ({ listing }: AuctionInfoTableProps) => {
  const ca = listing.custom_attributes || {};
  const attachments: { name: string; url: string }[] = ca.attachments || [];

  const rows = [
    { label: "Tên đơn vị tổ chức đấu giá", value: ca.org_name },
    { label: "Địa chỉ đơn vị đấu giá", value: ca.org_address },
    
    { label: "Tên đơn vị có tài sản", value: ca.asset_owner_name },
    { label: "Địa chỉ đơn vị có tài sản", value: ca.asset_owner_address },
    {
      label: "Thời gian bán hồ sơ",
      value: formatDateRange(ca.document_sale_start, ca.document_sale_end),
    },
    {
      label: "Thời gian xem tài sản",
      value: formatDateRange(ca.asset_viewing_start, ca.asset_viewing_end),
    },
    { label: "Thời gian đấu giá", value: formatSingleDate(ca.auction_time || ca.auction_date) },
    { label: "Địa điểm đấu giá", value: ca.auction_location || ca.org_address },
    { label: "Số điện thoại liên hệ", value: ca.org_phone },
    { label: "Email liên hệ", value: ca.org_email },
    { label: "Mã chuyển khoản", value: ca.bank_transfer_code },
  ].filter((r) => r.value);

  return (
    <div className="space-y-6">
      {/* Thông tin Bán đấu giá */}
      <Card className="overflow-hidden">
        <div className="bg-primary px-5 py-3">
          <h3 className="text-primary-foreground font-semibold text-base">Thông tin Bán đấu giá</h3>
        </div>
        <div className="divide-y divide-border">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[200px_1fr] md:grid-cols-[240px_1fr]">
              <div className="px-5 py-3 text-sm text-muted-foreground bg-muted/30">{row.label}</div>
              <div className="px-5 py-3 text-sm text-foreground font-medium">{row.value}</div>
            </div>
          ))}
          {/* File đính kèm */}
          {attachments.length > 0 && (
            <div className="grid grid-cols-[200px_1fr] md:grid-cols-[240px_1fr]">
              <div className="px-5 py-3 text-sm text-muted-foreground bg-muted/30">File đính kèm</div>
              <div className="px-5 py-3 space-y-2">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-destructive shrink-0" />
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {a.name}
                    </a>
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" asChild>
                      <a href={a.url} download>
                        <Download className="w-3.5 h-3.5 text-muted-foreground" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Thông tin người có tài sản */}
      {(ca.asset_owner_name || ca.asset_owner_address) && (
        <Card className="overflow-hidden">
          <div className="bg-primary px-5 py-3">
            <h3 className="text-primary-foreground font-semibold text-base">Thông tin người có tài sản</h3>
          </div>
          <div className="divide-y divide-border">
            {ca.asset_owner_name && (
              <div className="grid grid-cols-[200px_1fr] md:grid-cols-[240px_1fr]">
                <div className="px-5 py-3 text-sm text-muted-foreground bg-muted/30">Tên đơn vị</div>
                <div className="px-5 py-3 text-sm text-foreground font-medium">{ca.asset_owner_name}</div>
              </div>
            )}
            {ca.asset_owner_address && (
              <div className="grid grid-cols-[200px_1fr] md:grid-cols-[240px_1fr]">
                <div className="px-5 py-3 text-sm text-muted-foreground bg-muted/30">Địa chỉ</div>
                <div className="px-5 py-3 text-sm text-foreground font-medium">{ca.asset_owner_address}</div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
