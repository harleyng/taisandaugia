import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FeatureStat } from "@/lib/reports/transactionReport";

interface Props {
  data: FeatureStat[];
}

export default function CreditConsumptionTable({ data }: Props) {
  const totalCredits = data.reduce((s, d) => s + d.credits, 0);
  const totalCount = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Chi tiết theo tính năng</p>
        <p className="text-xs text-muted-foreground">Số lượt dùng và credit tiêu dùng của từng tính năng</p>
      </div>

      {data.length === 0 ? (
        <div className="h-24 rounded-lg border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">
          Chưa có tiêu dùng nào trong khoảng đã chọn
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tính năng</TableHead>
              <TableHead className="text-right">Lượt dùng</TableHead>
              <TableHead className="text-right">Credit tiêu dùng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.type}>
                <TableCell className="font-medium text-foreground">{d.label}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {d.count.toLocaleString("vi-VN")}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium text-foreground">
                  {d.credits.toLocaleString("vi-VN")}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 border-border">
              <TableCell className="font-semibold text-foreground">Tổng</TableCell>
              <TableCell className="text-right tabular-nums font-semibold text-foreground">
                {totalCount.toLocaleString("vi-VN")}
              </TableCell>
              <TableCell className="text-right tabular-nums font-semibold text-foreground">
                {totalCredits.toLocaleString("vi-VN")}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  );
}
