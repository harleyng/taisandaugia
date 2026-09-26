import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, FileBarChart, FileSpreadsheet, LockKeyhole, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ReportDocument } from "@/components/asset-owner-portal/periodic-report/ReportDocument";
import { ReportNotesCard } from "@/components/asset-owner-portal/periodic-report/ReportNotesCard";
import { FinalizeReportDialog } from "@/components/asset-owner-portal/periodic-report/FinalizeReportDialog";
import { DeleteReportDialog } from "@/components/asset-owner-portal/periodic-report/DeleteReportDialog";
import { ReportShareCard } from "@/components/asset-owner-portal/periodic-report/ReportShareCard";
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
  REPORT_STATUS_LABEL,
  canDraftReport,
  canFinalizeReport,
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
 * Một báo cáo định kỳ — /chu-tai-san/bao-cao-dinh-ky/:id (Phase 10).
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
  const scope = { role: membership?.role ?? null, branchScope: membership?.branchScope ?? null };
  const isDraft = report?.status === "draft";
  const canEdit = !!report && isDraft && canDraftReport(scope, report.branchId);
  const canFinalize = isDraft && canFinalizeReport(scope);

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

  const printButton = (primary: boolean) => (
    <Button variant={primary ? "default" : "outline"} className="gap-1.5" disabled={!payload} onClick={onPrint}>
      <Printer className="h-4 w-4" strokeWidth={1.5} />
      Xuất PDF
    </Button>
  );

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 gap-1 text-muted-foreground" onClick={() => navigate(REPORTS_HREF)}>
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
        Báo cáo định kỳ
      </Button>

      <OwnerPageHeader
        title={title}
        subtitle={[
          scopeLabel,
          REPORT_STATUS_LABEL[report.status],
          report.finalizedAt ? `chốt ngày ${formatReportDay(report.finalizedAt)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            {canFinalize && (
              <Button className="gap-1.5" disabled={!payload} onClick={() => setFinalizeOpen(true)}>
                <LockKeyhole className="h-4 w-4" strokeWidth={1.5} />
                Chốt báo cáo
              </Button>
            )}
            {!isDraft && printButton(true)}
            <Button variant="outline" className="gap-1.5" disabled={!payload} onClick={onExcel}>
              <FileSpreadsheet className="h-4 w-4" strokeWidth={1.5} />
              Tải Excel
            </Button>
            {isDraft && printButton(false)}
            {canEdit && (
              <Button variant="ghost" className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                Xoá nháp
              </Button>
            )}
          </>
        }
      />

      {isDraft && (
        <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Bản nháp</span> — số liệu cập nhật theo thời gian thực
          {payload?.meta.asOf ? `, tính đến ${formatReportDay(payload.meta.asOf)}` : ""}.{" "}
          {canFinalize
            ? "Chốt để đóng băng số liệu và gửi trụ sở."
            : "Trưởng đơn vị sẽ xem lại và chốt để gửi trụ sở."}
        </p>
      )}

      {!isDraft && <ReportShareCard report={report} canShare={canFinalizeReport(scope)} />}

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
        <div className="space-y-6">
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
        <ReportDocument payload={payload} status={report.status} />
      )}

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
