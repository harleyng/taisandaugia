import type { ReactNode } from "react";
import {
  AlertTriangle, CalendarRange, FileSpreadsheet, Gavel, GitBranch, LockKeyhole, Printer, Trash2, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DetailHero, type HeroStat } from "@/components/shared/DetailHero";
import { cn } from "@/lib/utils";
import { formatMoneyShort } from "@/utils/money";
import {
  REPORT_STATUS_LABEL,
  formatReportDay,
  type OwnerReport,
  type ReportPayload,
} from "@/lib/ownerPeriodicReport";

const STATUS_STYLE: Record<OwnerReport["status"], string> = {
  draft: "bg-warning/10 text-warning",
  final: "bg-success/10 text-success",
};

function Pill({ className, children }: { className: string; children: ReactNode }) {
  return <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", className)}>{children}</span>;
}

interface ReportDetailHeroProps {
  report: OwnerReport;
  /** null khi số liệu chưa dựng xong — ẩn cụm số, khoá nút xuất / chốt. */
  payload: ReportPayload | null;
  title: string;
  scopeLabel: string;
  canFinalize: boolean;
  canDelete: boolean;
  onFinalize: () => void;
  onPrint: () => void;
  onExcel: () => void;
  onDelete: () => void;
}

/**
 * Hero của trang chi tiết báo cáo định kỳ — cùng khuôn `DetailHero` với chi tiết hồ
 * sơ ký gửi: trạng thái, tên kỳ, hàng meta có icon, ba con số chính và thao tác.
 * Nút chính: "Chốt báo cáo" (nháp, Trưởng đơn vị) hoặc "Xuất PDF" (đã chốt).
 */
export function ReportDetailHero({
  report,
  payload,
  title,
  scopeLabel,
  canFinalize,
  canDelete,
  onFinalize,
  onPrint,
  onExcel,
  onDelete,
}: ReportDetailHeroProps) {
  const isDraft = report.status === "draft";
  const ready = !!payload;
  const period = payload?.meta.period;

  const stats: HeroStat[] = payload
    ? [
        { icon: Wallet, label: "Đã thu", value: formatMoneyShort(payload.money.collected) },
        { icon: Gavel, label: "Đấu thành", value: payload.money.soldCount },
        { icon: AlertTriangle, label: "Tồn đọng", value: payload.stuck.count },
      ]
    : [];

  return (
    <DetailHero
      status={<Pill className={STATUS_STYLE[report.status]}>{REPORT_STATUS_LABEL[report.status]}</Pill>}
      badges={
        isDraft ? (
          <Pill className="bg-muted text-muted-foreground">Số liệu trực tiếp</Pill>
        ) : (
          <Pill className="bg-muted text-muted-foreground">Chốt ngày {formatReportDay(report.finalizedAt)}</Pill>
        )
      }
      name={title}
      subtitle={
        <>
          <span className="inline-flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5 shrink-0" />
            {scopeLabel}
          </span>
          {period && (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <CalendarRange className="h-3.5 w-3.5 shrink-0" />
              {formatReportDay(period.start)} – {formatReportDay(period.end)}
            </span>
          )}
        </>
      }
      stats={stats}
      actions={
        <>
          {canFinalize && (
            <Button className="gap-1.5" disabled={!ready} onClick={onFinalize}>
              <LockKeyhole className="h-4 w-4" strokeWidth={1.5} />
              Chốt báo cáo
            </Button>
          )}
          <Button variant={isDraft ? "outline" : "default"} className="gap-1.5" disabled={!ready} onClick={onPrint}>
            <Printer className="h-4 w-4" strokeWidth={1.5} />
            Xuất PDF
          </Button>
          <Button variant="outline" className="gap-1.5" disabled={!ready} onClick={onExcel}>
            <FileSpreadsheet className="h-4 w-4" strokeWidth={1.5} />
            Tải Excel
          </Button>
        </>
      }
      overflow={
        canDelete ? (
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Xoá nháp
          </DropdownMenuItem>
        ) : undefined
      }
    />
  );
}
