import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, Filter } from "lucide-react";
import type { PortfolioFilter } from "@/hooks/useOwnerPortfolioMetrics";

interface Props {
  filter: PortfolioFilter;
  viewedAt: Date;
}

export function ReportHeader({ filter, viewedAt }: Props) {
  const chips: string[] = [];
  if (filter.propertyTypeSlugs?.length) chips.push(...filter.propertyTypeSlugs);
  if (filter.provinces?.length) chips.push(...filter.provinces);
  if (filter.auctionOrgIds?.length) chips.push(`${filter.auctionOrgIds.length} TCDG`);
  if (filter.dateFrom || filter.dateTo) {
    chips.push(`${filter.dateFrom ?? "..."} → ${filter.dateTo ?? "..."}`);
  }
  const isDefault = chips.length === 0;

  const dateStr = viewedAt.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-border print:border-none">
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {isDefault ? (
            <Badge variant="secondary">Toàn bộ danh mục</Badge>
          ) : (
            chips.map((c) => (
              <Badge key={c} variant="secondary">{c}</Badge>
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground">Ngày xuất: {dateStr}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="print:hidden"
        onClick={() => window.print()}
      >
        <Printer className="w-3.5 h-3.5 mr-1.5" />
        Xuất PDF
      </Button>
    </div>
  );
}
