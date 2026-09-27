import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ReportDocument } from "@/components/asset-owner-portal/periodic-report/ReportDocument";
import { ReportNotesCard } from "@/components/asset-owner-portal/periodic-report/ReportNotesCard";
import { FinalizeReportDialog } from "@/components/asset-owner-portal/periodic-report/FinalizeReportDialog";
import { DeleteReportDialog } from "@/components/asset-owner-portal/periodic-report/DeleteReportDialog";
import { ReportShareCard } from "@/components/asset-owner-portal/periodic-report/ReportShareCard";
import { ReportSummaryCard } from "@/components/asset-owner-portal/periodic-report/ReportSummaryCard";
import { ReportDetailHero } from "@/components/asset-owner-portal/periodic-report/ReportDetailHero";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";
import {
  useDeleteReportDraft,
  useFinalizeReport,
  useOwnerReport,
  useOwnerReportPayload,
  useSaveReportNotes,
} from "@/hooks/useOwnerPeriodicReports";
import { todayIso } from "@/lib/ownerOutcomeReport";
import { periodEndOf } from "@/lib/ownerTargets";
import {
  REPORTS_HREF,
  canDraftReport,
  canFinalizeReport,
  canShareReport,
  formatReportDay,
  isPeriodOver,
  reportFileName,
  reportNotesSchema,
  reportPrintHref,
  reportScopeLabel,
  reportTitle,
  type ReportNotesForm,
} from "@/lib/ownerPeriodicReport";
import { downloadReportXlsx } from "@/lib/ownerPeriodicReportExcel";

/**
 * Một báo cáo định kỳ — /chu-tai-san/bao-cao-dinh-ky/:id (Phase 10). Bố cục hai cột như
 * chi tiết hồ sơ ký gửi: hero (trạng thái, số chính, thao tác) → nội dung báo cáo bên trái,
 * thông tin / chia sẻ bên phải.
 * Nháp: số liệu tính trực tiếp + ô ghi chú + "Chốt báo cáo" (Trưởng đơn vị).
 * Đã chốt: payload đóng băng, chỉ xem / in / tải Excel / chia sẻ link chỉ đọc cho trụ sở
 * (Phase 11 — chỉ Trưởng đơn vị). Quyền xét theo không gian
 * CỦA BÁO CÁO (không theo không gian đang chọn) — link có thể mở từ nơi khác.
 */
const OwnerPeriodicReportDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { memberships, isLoading: wsLoading } = useOwnerWorkspace();
  const { data: report, isLoading: reportLoading, isError: reportError } = useOwnerReport(id);
  const { payload, isLoading: payloadLoading, isError: payloadError, refetch } = useOwnerReportPayload(report);
  const { data: branchOptions = [] } = useWorkspaceBranchOptions(report?.workspaceId ?? null);

  const membership = report ? memberships.find((m) => m.workspaceId === report.workspaceId) : undefined;
  const access = membership?.access ?? null;
  const isDraft = report?.status === "draft";
  const canEdit = !!report && isDraft && canDraftReport(access, report.branchId);
  const canFinalize = !!report && isDraft && canFinalizeReport(access, report.branchId);

  const form = useForm<ReportNotesForm>({
    resolver: zodResolver(reportNotesSchema),
    defaultValues: { planNote: "", notes: "" },
  });
  useEffect(() => {
    if (report) form.reset({ planNote: report.planNote ?? "", notes: report.notes ?? "" });
    // Chỉ nạp lại khi bản ghi đổi thật (lưu xong) — không đè chữ đang gõ khi refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.id, report?.updatedAt]);

  const saveNotes = useSaveReportNotes(report);
  const finalize = useFinalizeReport(report);
  const del = useDeleteReportDraft(report);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (wsLoading || reportLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (reportError || !report) {
    return (
      <EmptyState
        icon={FileBarChart}
        tone={reportError ? "destructive" : "muted"}
        title={reportError ? "Chưa tải được báo cáo." : "Không tìm thấy báo cáo"}
        description={
          reportError ? undefined : "Bản nháp có thể đã bị xoá, hoặc bạn không còn là thành viên của đơn vị lập báo cáo."
        }
        action={<Button onClick={() => navigate(REPORTS_HREF)}>Về danh sách báo cáo</Button>}
      />
    );
  }

  const title = reportTitle(report.periodType, report.periodStart);
  const scopeLabel = payload
    ? reportScopeLabel(payload.meta.scope)
    : report.branchId
      ? branchOptions.find((b) => b.id === report.branchId)?.label ?? "Chi nhánh"
      : "Toàn đơn vị";
  const today = todayIso();
  const periodOpen = !isPeriodOver(report.periodType, report.periodStart, today);

  const onSaveNotes = form.handleSubmit((values) => saveNotes.mutate(values));
  const onFinalize = async () => {
    if (form.formState.isDirty) {
      if (!(await form.trigger())) return setFinalizeOpen(false);
      try {
        await saveNotes.mutateAsync(form.getValues());
      } catch {
        return; // toast đã báo ở onError
      }
    }
    finalize.mutate(undefined, { onSuccess: () => setFinalizeOpen(false) });
  };
  const onExcel = () => {
    if (!payload) return;
    const name = reportFileName(payload, "xlsx");
    downloadReportXlsx(payload, report.status, isDraft ? name.replace(/\.xlsx$/, "-ban-nhap.xlsx") : name);
  };
  const onPrint = () => window.open(`${reportPrintHref(report.id)}?auto=1`, "_blank", "noopener");

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate(REPORTS_HREF)}>
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
        Báo cáo định kỳ
      </Button>

      <ReportDetailHero
        report={report}
        payload={payload ?? null}
        title={title}
        scopeLabel={scopeLabel}
        canFinalize={canFinalize}
        canDelete={canEdit}
        onFinalize={() => setFinalizeOpen(true)}
        onPrint={onPrint}
        onExcel={onExcel}
        onDelete={() => setDeleteOpen(true)}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-5">
          {isDraft && (
            <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Bản nháp</span> — số liệu cập nhật theo thời gian thực
              {payload?.meta.asOf ? `, tính đến ${formatReportDay(payload.meta.asOf)}` : ""}.{" "}
              {canFinalize
                ? "Chốt để đóng băng số liệu và gửi trụ sở."
                : "Trưởng đơn vị sẽ xem lại và chốt để gửi trụ sở."}
            </p>
          )}

          {isDraft && (
            <ReportNotesCard
              form={form}
              onSave={() => void onSaveNotes()}
              saving={saveNotes.isPending}
              canEdit={canEdit}
              primary={!canFinalize}
            />
          )}

          {payloadLoading ? (
            <div className="space-y-5">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          ) : payloadError || !payload ? (
            <EmptyState
              icon={FileBarChart}
              tone="destructive"
              title="Chưa dựng được số liệu báo cáo."
              action={
                isDraft ? (
                  <Button variant="outline" onClick={() => void refetch()}>
                    Thử lại
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ReportDocument payload={payload} status={report.status} showHero={false} />
          )}
        </div>

        {/* Cột phải: thông tin + chia sẻ. Mobile xếp sau nội dung báo cáo. */}
        <aside className="space-y-5 lg:sticky lg:top-4">
          <ReportSummaryCard report={report} payload={payload ?? null} scopeLabel={scopeLabel} />
          {!isDraft && <ReportShareCard report={report} canShare={canShareReport(access, report.branchId)} />}
        </aside>
      </div>

      <FinalizeReportDialog
        open={finalizeOpen}
        onOpenChange={setFinalizeOpen}
        title={title}
        periodEndsOn={periodOpen ? periodEndOf(report.periodType, report.periodStart) : null}
        hasUnsavedNotes={form.formState.isDirty}
        busy={finalize.isPending || saveNotes.isPending}
        onConfirm={() => void onFinalize()}
      />
      <DeleteReportDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        busy={del.isPending}
        onConfirm={() => del.mutate(undefined, { onSuccess: () => navigate(REPORTS_HREF) })}
      />
    </div>
  );
};

export default OwnerPeriodicReportDetailPage;
