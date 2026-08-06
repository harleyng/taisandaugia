import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd } from "@/lib/advertising/slug";
import type { TopEntityStat } from "@/lib/reports/listingsReport";
import ReportCard from "./ReportCard";

interface Props {
  title: string;
  subtitle: string;
  nameHeader: string;
  rows: TopEntityStat[];
  loading?: boolean;
}

/** Bảng "top N theo số tin" — dùng chung cho tổ chức đấu giá và chủ tài sản. */
export default function ListingsTopEntitiesTable({
  title,
  subtitle,
  nameHeader,
  rows,
  loading,
}: Props) {
  const empty = !loading && rows.length === 0;

  return (
    <ReportCard title={title} subtitle={subtitle} loading={loading} empty={empty}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-8">#</TableHead>
              <TableHead className="text-xs">{nameHeader}</TableHead>
              <TableHead className="text-xs text-right">Số tin</TableHead>
              <TableHead className="text-xs text-right">Giá trị khởi điểm</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, idx) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {idx + 1}
                </TableCell>
                <TableCell className="text-sm text-foreground">
                  <p className="truncate max-w-[280px]" title={r.name}>
                    {r.name}
                  </p>
                  {r.sub && (
                    <p className="text-[11px] text-muted-foreground/70 truncate max-w-[280px]">
                      {r.sub}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-sm text-right tabular-nums text-foreground">
                  {r.listings.toLocaleString("vi-VN")}
                </TableCell>
                <TableCell className="text-sm text-right tabular-nums text-foreground">
                  {formatVnd(r.value)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReportCard>
  );
}
