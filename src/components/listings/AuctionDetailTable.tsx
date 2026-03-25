import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AuctionDetailTableProps {
  attributes: Record<string, any>;
}

const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const formatDateRange = (start: string | null | undefined, end: string | null | undefined): string => {
  if (!start && !end) return "";
  if (start && end) return `${formatDateTime(start)} → ${formatDateTime(end)}`;
  return formatDateTime(start || end);
};

export const AuctionDetailTable = ({ attributes }: AuctionDetailTableProps) => {
  const a = attributes;

  const rows: { label: string; value: string | null | undefined }[] = [
    { label: "Tên đơn vị tổ chức đấu giá", value: a.org_name },
    { label: "Địa chỉ đơn vị đấu giá", value: a.org_address },
    { label: "Địa điểm bán đấu giá", value: a.auction_location },
    { label: "Tên đơn vị có tài sản", value: a.asset_owner_name },
    { label: "Địa chỉ đơn vị có tài sản", value: a.asset_owner_address },
    { label: "Thời gian bán hồ sơ", value: formatDateRange(a.document_sale_start, a.document_sale_end) },
    { label: "Thời gian xem tài sản", value: formatDateRange(a.asset_viewing_start, a.asset_viewing_end) },
    { label: "Thời gian đấu giá", value: formatDateTime(a.auction_time) },
    { label: "Hạn đăng ký tham gia", value: formatDateTime(a.registration_deadline) },
    { label: "Số điện thoại liên hệ", value: a.org_phone },
    { label: "Email liên hệ", value: a.org_email },
    { label: "Mã chuyển khoản", value: a.bank_transfer_code },
  ];

  const visibleRows = rows.filter(r => r.value);
  const attachments = a.attachments as { name: string; url: string }[] | undefined;

  if (visibleRows.length === 0 && !attachments?.length) return null;

  return (
    <Card className="overflow-hidden">
      <div className="bg-primary px-5 py-3">
        <h2 className="text-lg font-bold text-primary-foreground">Thông tin Bán đấu giá</h2>
      </div>
      <Table>
        <TableBody>
          {visibleRows.map((row, idx) => (
            <TableRow key={idx}>
              <TableCell className="font-medium text-muted-foreground w-[40%] align-top text-sm py-3">
                {row.label}
              </TableCell>
              <TableCell className="text-foreground text-sm py-3">
                {row.value}
              </TableCell>
            </TableRow>
          ))}
          {attachments && attachments.length > 0 && (
            <TableRow>
              <TableCell className="font-medium text-muted-foreground w-[40%] align-top text-sm py-3">
                File đính kèm
              </TableCell>
              <TableCell className="text-sm py-3">
                <div className="space-y-2">
                  {attachments.map((file, i) => (
                    <Button
                      key={i}
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1.5 text-primary hover:text-primary/80 justify-start"
                      onClick={() => file.url !== "#" && window.open(file.url, "_blank")}
                    >
                      <FileText className="w-4 h-4 mr-2 shrink-0 text-destructive" />
                      <span className="text-sm underline">{file.name}</span>
                      <Download className="w-3 h-3 ml-2 shrink-0" />
                    </Button>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
};
