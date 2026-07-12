import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PageStat } from "@/lib/reports/accessAnalytics";
import ReportCard from "./ReportCard";

interface Props {
  data: PageStat[];
  loading?: boolean;
}

const num = (n: number) => n.toLocaleString("vi-VN");

export default function TopPagesTable({ data, loading }: Props) {
  const empty = !loading && data.length === 0;
  const totalViews = data.reduce((s, d) => s + d.views, 0);

  return (
    <ReportCard
      title="Tổng truy cập theo từng trang"
      subtitle="Các trang được xem nhiều nhất (segment id đã gộp về :id)"
      loading={loading}
      empty={empty}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Đường dẫn</TableHead>
            <TableHead className="text-right">Lượt xem</TableHead>
            <TableHead className="text-right">Người xem</TableHead>
            <TableHead className="text-right">Tỉ trọng</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((d) => (
            <TableRow key={d.path}>
              <TableCell className="font-medium text-foreground truncate max-w-[220px]">{d.path}</TableCell>
              <TableCell className="text-right tabular-nums font-medium text-foreground">{num(d.views)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{num(d.uniqueUsers)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {totalViews > 0 ? ((d.views / totalViews) * 100).toFixed(1) : "0"}%
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ReportCard>
  );
}
