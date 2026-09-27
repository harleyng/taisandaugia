import { FileSpreadsheet, MoreHorizontal, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReportStatus } from "@/lib/ownerPeriodicReport";
import { ReportStatusChip } from "./ReportStatusChip";

interface ReportDetailHeaderProps {
  title: string;
  status: ReportStatus;
  /** "01/07 – 30/09/2026 · Toàn đơn vị · 3 chi nhánh". */
  subtitle: string;
  /** false khi số liệu chưa dựng xong — khoá xuất file. */
  ready: boolean;
  canDelete: boolean;
  onPrint: () => void;
  onExcel: () => void;
  onDelete: () => void;
}

/** Đầu trang chi tiết: tên kỳ + trạng thái, khoảng ngày · phạm vi; Xuất PDF, còn lại trong menu ⋯. */
export function ReportDetailHeader({
  title,
  status,
  subtitle,
  ready,
  canDelete,
  onPrint,
  onExcel,
  onDelete,
}: ReportDetailHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-2.5 text-[22px] font-bold tracking-tight text-foreground">
          {title}
          <ReportStatusChip status={status} />
        </h1>
        <p className="mt-0.5 text-[13.5px] tabular-nums text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" className="gap-1.5" disabled={!ready} onClick={onPrint}>
          <Printer className="h-4 w-4" strokeWidth={1.5} />
          Xuất PDF
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Thao tác khác">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={!ready} onSelect={onExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" strokeWidth={1.5} />
              Tải Excel
            </DropdownMenuItem>
            {canDelete && (
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.5} />
                Xoá nháp
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
