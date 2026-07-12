import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FeatureUsageStat } from "@/lib/reports/accessAnalytics";

interface Props {
  data: FeatureUsageStat[];
}

const num = (n: number) => n.toLocaleString("vi-VN");

export default function FeatureUsageTable({ data }: Props) {
  const totalCount = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Chi tiết theo tính năng</p>
        <p className="text-xs text-muted-foreground">Số lượt và số người dùng duy nhất của từng tính năng</p>
      </div>

      {data.length === 0 ? (
        <div className="h-24 rounded-lg border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">
          Chưa có lượt dùng nào trong khoảng đã chọn
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tính năng</TableHead>
              <TableHead className="text-right">Theo lượt</TableHead>
              <TableHead className="text-right">Theo người</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.key}>
                <TableCell className="font-medium text-foreground">{d.label}</TableCell>
                <TableCell className="text-right tabular-nums font-medium text-foreground">{num(d.count)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{num(d.uniqueUsers)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 border-border">
              <TableCell className="font-semibold text-foreground">Tổng lượt</TableCell>
              <TableCell className="text-right tabular-nums font-semibold text-foreground">{num(totalCount)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">—</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}
