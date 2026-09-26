import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileBarChart, Link2Off, Printer } from "lucide-react";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ReportSheet } from "@/components/asset-owner-portal/periodic-report/ReportSheet";
import { SharedReportCta } from "@/components/asset-owner-portal/periodic-report/SharedReportCta";
import { useSharedOwnerReport } from "@/hooks/useOwnerReportShare";
import { todayIso } from "@/lib/ownerOutcomeReport";
import { formatReportDay, reportTitle } from "@/lib/ownerPeriodicReport";
import {
  SHARED_REPORT_UNAVAILABLE,
  formatShareDay,
  type SharedReportError,
  type SharedReportOk,
} from "@/lib/ownerReportShare";

/**
 * Báo cáo định kỳ chia sẻ qua link chỉ đọc — /r/:token (docs/owner-control-tower-plan.md
 * Phase 11). CÔNG KHAI (ngoài ProtectedRoute): người nhận ở trụ sở không cần tài khoản.
 * Server chỉ trả payload đã lọc (không id, không người trúng, không biên bản); mỗi lần
 * mở là một lượt xem nên hook chỉ gọi RPC đúng một lần.
 */
const SharedOwnerReportPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useSharedOwnerReport(token);
  const report = data?.ok === true ? (data as SharedReportOk) : null;

  // Dữ liệu nợ xấu: không cho máy tìm kiếm lập chỉ mục dù link có bị dán ở đâu.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const title = report ? reportTitle(report.payload.meta.period.type, report.payload.meta.period.start) : null;
  useEffect(() => {
    const previous = document.title;
    document.title = `${title ?? "Báo cáo chia sẻ"} · taisandaugia`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  const unavailable = data?.ok === false ? (data as SharedReportError) : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-0 z-10 border-b bg-background print:hidden">
        <div className="mx-auto flex max-w-[210mm] items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="taisandaugia" className="h-7 w-auto shrink-0" />
            <p className="min-w-0 truncate text-xs text-muted-foreground">
              Báo cáo chỉ đọc
              {report?.expiresAt && (
                <span className="hidden sm:inline"> · link có hiệu lực đến {formatShareDay(report.expiresAt)}</span>
              )}
            </p>
          </div>
          {report && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              aria-label="In / Lưu PDF"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">In / Lưu PDF</span>
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="mx-auto max-w-[210mm] space-y-6 px-4 py-8">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : report ? (
        <>
          <ReportSheet
            payload={report.payload}
            status="final"
            variant="shared"
            footerNote={`bản chia sẻ chỉ đọc, xem ngày ${formatReportDay(todayIso())}`}
          />
          <div className="mx-auto max-w-[210mm] px-4 pb-10">
            <SharedReportCta />
          </div>
        </>
      ) : (
        <div className="mx-auto max-w-[210mm] px-4 py-12">
          {unavailable ? (
            <EmptyState
              icon={Link2Off}
              tone="muted"
              title={SHARED_REPORT_UNAVAILABLE[unavailable.reason].title}
              description={
                unavailable.reason === "expired" && unavailable.expiredAt
                  ? `Link chia sẻ báo cáo này đã hết hạn ngày ${formatShareDay(unavailable.expiredAt)}. ${SHARED_REPORT_UNAVAILABLE.expired.description}`
                  : SHARED_REPORT_UNAVAILABLE[unavailable.reason].description
              }
              action={
                <Button variant="outline" onClick={() => navigate("/")}>
                  Đến trang chủ taisandaugia
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={FileBarChart}
              tone="destructive"
              title="Chưa tải được báo cáo."
              description={isError ? "Kết nối có thể đang chập chờn. Vui lòng thử lại." : undefined}
              action={
                <Button variant="outline" onClick={() => void refetch()}>
                  Thử lại
                </Button>
              }
            />
          )}
        </div>
      )}
    </div>
  );
};

export default SharedOwnerReportPage;
