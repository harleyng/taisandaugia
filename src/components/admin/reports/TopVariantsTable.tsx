import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd } from "@/lib/advertising/slug";
import type { RevenueServiceStat } from "@/lib/reports/revenueReport";

interface Props {
  data: RevenueServiceStat[];
}

const AUDIENCE_LABELS: Record<string, string> = {
  buyer: "Người mua",
  owner: "Chủ tài sản",
  company: "Công ty",
  all: "Dùng chung",
};

export default function TopVariantsTable({ data }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Top gói bán chạy</p>
        <p className="text-xs text-muted-foreground">Gói credit theo doanh thu (đã suy ra VND từ biến thể)</p>
      </div>
      {data.length === 0 ? (
        <div className="h-24 rounded-lg border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">
          Chưa có doanh thu gói trong khoảng đã chọn
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gói</TableHead>
              <TableHead>Đối tượng</TableHead>
              <TableHead className="text-right">Lượt</TableHead>
              <TableHead className="text-right">Doanh thu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.key}>
                <TableCell className="font-medium text-foreground">{d.label}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{AUDIENCE_LABELS[d.audience ?? ""] ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{d.count.toLocaleString("vi-VN")}</TableCell>
                <TableCell className="text-right tabular-nums font-medium text-foreground">{formatVnd(d.vnd)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
