import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd } from "@/lib/advertising/slug";
import type { RevenueServiceStat } from "@/lib/reports/revenueReport";

interface Props {
  data: RevenueServiceStat[];
}

import { SOURCE_BADGE_CLASS, sourceLabel } from "@/lib/reports/revenueSource";

export default function RevenueByServiceTable({ data }: Props) {
  const totalVnd = data.reduce((s, d) => s + d.vnd, 0);
  const totalCount = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Doanh thu theo dịch vụ</p>
        <p className="text-xs text-muted-foreground">Nạp credit, dịch vụ trực tiếp và hoa hồng môi giới, phân biệt bằng nguồn</p>
      </div>

      {data.length === 0 ? (
        <div className="h-24 rounded-lg border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">
          Chưa có doanh thu trong khoảng đã chọn
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dịch vụ</TableHead>
              <TableHead>Nguồn</TableHead>
              <TableHead className="text-right">Số lượng</TableHead>
              <TableHead className="text-right">Doanh thu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.key}>
                <TableCell className="font-medium text-foreground">{d.label}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${SOURCE_BADGE_CLASS[d.source]}`}>
                    {sourceLabel(d.source)}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {d.count.toLocaleString("vi-VN")}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium text-foreground">{formatVnd(d.vnd)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 border-border">
              <TableCell className="font-semibold text-foreground" colSpan={2}>Tổng</TableCell>
              <TableCell className="text-right tabular-nums font-semibold text-foreground">
                {totalCount.toLocaleString("vi-VN")}
              </TableCell>
              <TableCell className="text-right tabular-nums font-semibold text-foreground">{formatVnd(totalVnd)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}
