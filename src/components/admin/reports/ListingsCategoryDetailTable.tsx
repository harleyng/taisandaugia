import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatVnd } from "@/lib/advertising/slug";
import type { CategoryChildStat } from "@/lib/reports/listingsReport";
import ReportCard from "./ReportCard";

interface Props {
  data: CategoryChildStat[];
  loading?: boolean;
}

/**
 * Chi tiết theo slug gốc. Mục đích chính là soi taxonomy drift: slug nào đang
 * rơi vào nhóm "Khác" thì hiện rõ ở đây thay vì bị nuốt trong biểu đồ cột.
 */
export default function ListingsCategoryDetailTable({ data, loading }: Props) {
  const empty = !loading && data.length === 0;
  const total = data.reduce((s, d) => s + d.listings, 0);

  return (
    <ReportCard
      title="Chi tiết theo loại tài sản"
      subtitle="Slug gốc trong tin — dòng thuộc nhóm 'Khác' là loại chưa được phân nhóm"
      loading={loading}
      empty={empty}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Loại tài sản</TableHead>
              <TableHead className="text-xs">Nhóm</TableHead>
              <TableHead className="text-xs text-right">Số tin</TableHead>
              <TableHead className="text-xs text-right">Tỉ trọng</TableHead>
              <TableHead className="text-xs text-right">Giá trị khởi điểm</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((d) => (
              <TableRow key={d.slug}>
                <TableCell className="text-sm text-foreground">
                  {d.name}
                  {d.name !== d.slug && (
                    <span className="text-[11px] text-muted-foreground/70 ml-1.5">{d.slug}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  <span
                    className={
                      d.parentSlug === "khac"
                        ? "text-amber-700 bg-amber-50 rounded px-1.5 py-0.5"
                        : "text-muted-foreground"
                    }
                  >
                    {d.parentLabel}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-right tabular-nums text-foreground">
                  {d.listings.toLocaleString("vi-VN")}
                </TableCell>
                <TableCell className="text-sm text-right tabular-nums text-muted-foreground">
                  {total > 0 ? ((d.listings / total) * 100).toFixed(1) : "0"}%
                </TableCell>
                <TableCell className="text-sm text-right tabular-nums text-foreground">
                  {formatVnd(d.value)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </ReportCard>
  );
}
