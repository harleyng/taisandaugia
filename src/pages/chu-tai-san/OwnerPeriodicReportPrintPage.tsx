import { useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportSheet } from "@/components/asset-owner-portal/periodic-report/ReportSheet";
import { useOwnerReport, useOwnerReportPayload } from "@/hooks/useOwnerPeriodicReports";
import { todayIso } from "@/lib/ownerOutcomeReport";
import { REPORTS_HREF, formatReportDay, reportHref, reportTitle } from "@/lib/ownerPeriodicReport";

/**
 * Trang in / lưu PDF của một báo cáo định kỳ — /chu-tai-san/bao-cao-dinh-ky/:id/in.
 * Nằm NGOÀI OwnerPortalLayout (không sidebar / topbar) nhưng vẫn sau ProtectedRoute.
 * `?auto=1` ⇒ tự mở hộp thoại in khi số liệu đã sẵn sàng.
 */
const OwnerPeriodicReportPrintPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: report, isLoading: reportLoading } = useOwnerReport(id);
  const { payload, isLoading: payloadLoading } = useOwnerReportPayload(report);
  const printed = useRef(false);

  const title = report ? reportTitle(report.periodType, report.periodStart) : "Báo cáo định kỳ";

  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Trạm Điều Hành`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  useEffect(() => {
    if (!payload || printed.current || params.get("auto") !== "1") return;
    printed.current = true;
    // Chờ ảnh logo + bố cục xong rồi mới in.
    const t = window.setTimeout(() => window.print(), 500);
    return () => window.clearTimeout(t);
  }, [payload, params]);

  if (reportLoading || payloadLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report || !payload) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-base font-semibold text-foreground">Không mở được báo cáo để in.</p>
        <Button variant="outline" onClick={() => navigate(REPORTS_HREF)}>
          Về danh sách báo cáo
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background px-4 py-3 print:hidden">
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={() => navigate(reportHref(report.id))}>
          <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
          Về báo cáo
        </Button>
        <Button className="gap-1.5" onClick={() => window.print()}>
          <Printer className="h-4 w-4" strokeWidth={1.5} />
          In / Lưu PDF
        </Button>
      </div>

      <ReportSheet
        payload={payload}
        status={report.status}
        variant="print"
        footerNote={`in ngày ${formatReportDay(todayIso())}`}
      />
    </div>
  );
};

export default OwnerPeriodicReportPrintPage;
