import logo from "@/assets/logo.png";
import { TARGET_PERIOD_LABEL } from "@/lib/ownerTargets";
import { formatReportDay, reportScopeLabel, reportTitle, type ReportPayload, type ReportStatus } from "@/lib/ownerPeriodicReport";
import { ReportDocument } from "./ReportDocument";

// A4 dọc. Chân trang "taisandaugia.vn · Trang x/y" lặp mỗi trang bằng ô lề @page
// (Chrome/Edge ≥ 131; trình duyệt khác bỏ qua, logo cuối tài liệu vẫn còn).
// print-color-adjust: giữ nền nhạt của thẻ / thanh tiến độ khi in.
const PRINT_CSS = `
@page {
  size: A4 portrait;
  margin: 14mm 12mm 16mm;
  @bottom-left { content: "taisandaugia.vn"; font-size: 8pt; }
  @bottom-right { content: "Trang " counter(page) " / " counter(pages); font-size: 8pt; }
}
@media print {
  html, body { background: hsl(var(--background)); }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

interface ReportSheetProps {
  payload: ReportPayload;
  status: ReportStatus;
  /** "print" = trang in trong cổng; "shared" = link chia sẻ /r/:token (vẫn in được). */
  variant: "print" | "shared";
  /** Câu đầu của chân trang, vd "in ngày 26/09/2026". */
  footerNote: string;
}

/**
 * Tờ báo cáo A4 (§A8.9): tiêu đề (đơn vị, kỳ, phạm vi, trạng thái) → 6 phần của báo cáo
 * → chân trang có logo. Dùng chung cho trang in /chu-tai-san/bao-cao-dinh-ky/:id/in và
 * trang công khai /r/:token. Không có thanh công cụ — mỗi trang tự đặt ở trên.
 */
export function ReportSheet({ payload, status, variant, footerNote }: ReportSheetProps) {
  const { meta } = payload;

  return (
    <>
      <style>{PRINT_CSS}</style>
      <main className="mx-auto max-w-[210mm] space-y-6 px-4 py-8 print:max-w-none print:space-y-4 print:p-0">
        <header className="break-inside-avoid space-y-1 border-b pb-4">
          {meta.unitName && <p className="text-sm text-muted-foreground">{meta.unitName}</p>}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {reportTitle(meta.period.type, meta.period.start)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {reportScopeLabel(meta.scope)} · {TARGET_PERIOD_LABEL[meta.period.type]} {formatReportDay(meta.period.start)} –{" "}
            {formatReportDay(meta.period.end)} · tồn đọng và lịch sắp tới tính đến {formatReportDay(meta.asOf)}
          </p>
          <p className="text-sm text-foreground">
            {status === "draft" ? (
              <span className="font-semibold">BẢN NHÁP — số liệu chưa chốt, có thể còn thay đổi.</span>
            ) : (
              `Đã chốt ngày ${formatReportDay(payload.finalizedAt)} — số liệu được giữ nguyên như lúc chốt.`
            )}
          </p>
        </header>

        <ReportDocument payload={payload} status={status} variant={variant} />

        <footer className="flex break-inside-avoid items-center justify-between gap-4 border-t pt-4 text-xs text-muted-foreground">
          <span>
            Lập từ Trạm Điều Hành · {footerNote}. Mỗi con số kèm nguồn: Sàn xác nhận, Đã đối chiếu, Tự khai, Ước tính.
          </span>
          <img src={logo} alt="taisandaugia" className="h-6 w-auto shrink-0" />
        </footer>
      </main>
    </>
  );
}
