import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, FileBarChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { FinalizeReportDialog } from "@/components/asset-owner-portal/periodic-report/FinalizeReportDialog";
import { DeleteReportDialog } from "@/components/asset-owner-portal/periodic-report/DeleteReportDialog";
import { ReportShareCard } from "@/components/asset-owner-portal/periodic-report/ReportShareCard";
import { ReportDetailHeader } from "@/components/asset-owner-portal/periodic-report/ReportDetailHeader";
import { ReportConclusionHero } from "@/components/asset-owner-portal/periodic-report/ReportConclusionHero";
import { ReportKpiCards, type PreviousFigures } from "@/components/asset-owner-portal/periodic-report/ReportKpiCards";
import { ReportAttentionCard } from "@/components/asset-owner-portal/periodic-report/ReportAttentionCard";
import { ReportBranchTable } from "@/components/asset-owner-portal/periodic-report/ReportBranchTable";
import { ReportInsightCard } from "@/components/asset-owner-portal/periodic-report/ReportInsightCard";
import { ReportDetailsSection } from "@/components/asset-owner-portal/periodic-report/ReportDetailsSection";
import { ReportDraftPanel, ReportFinalPanel } from "@/components/asset-owner-portal/periodic-report/ReportSendPanel";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";
import {
  useDeleteReportDraft,
  useFinalizeReport,
  useOwnerReport,
  useOwnerReportPayload,
  useOwnerReports,
  useSaveReportNotes,
} from "@/hooks/useOwnerPeriodicReports";
import { todayIso } from "@/lib/ownerOutcomeReport";
import { periodEndOf, periodLabel, shiftPeriod } from "@/lib/ownerTargets";
import {
  REPORTS_HREF,
  canDraftReport,
  canFinalizeReport,
  canShareReport,
  isPeriodOver,
  reportFileName,
  reportNotesSchema,
  reportPrintHref,
  reportScopeLabel,
  reportTitle,
  type ReportNotesForm,
} from "@/lib/ownerPeriodicReport";
import { reportDueDate, reportRangeLabel } from "@/lib/ownerReportDigest";
import { downloadReportXlsx } from "@/lib/ownerPeriodicReportExcel";

/**
 * Một báo cáo định kỳ — /chu-tai-san/bao-cao-dinh-ky/:id (Phase 10; design "Bao Cao Dinh
 * Ky Chu Tai San"). Trái: kết luận kỳ → 3 số chính → cần lưu ý → theo chi nhánh →
 * nhận định & đề xuất → chi tiết số liệu (thu gọn). Phải: "Để chốt báo cáo" (nháp) hoặc
 * "Đã chốt" + chia sẻ với trụ sở.
 * Nháp: số liệu tính trực tiếp; đã chốt: payload đóng băng. Quyền xét theo không gian
 * CỦA BÁO CÁO (không theo không gian đang chọn) — link có thể mở từ nơi khác.
 */
const OwnerPeriodicReportDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { memberships, isLoading: wsLoading } = useOwnerWorkspace();
  const { data: report, isLoading: reportLoading, isError: reportError } = useOwnerReport(id);
  const { payload, isLoading: payloadLoading, isError: payloadError, refetch } = useOwnerReportPayload(report);
  const { data: branchOptions = [] } = useWorkspaceBranchOptions(report?.workspaceId ?? null);
  const { reports: siblings } = useOwnerReports(report?.workspaceId);

  const membership = report ? memberships.find((m) => m.workspaceId === report.workspaceId) : undefined;
  const access = membership?.access ?? null;
  const isDraft = report?.status === "draft";
  const canEdit = !!report && isDraft && canDraftReport(access, report.branchId);
  const canFinalize = !!report && isDraft && canFinalizeReport(access, report.branchId);
  const canShare = !!report && canShareReport(access, report.branchId);

  const form = useForm<ReportNotesForm>({
    resolver: zodResolver(reportNotesSchema),
    defaultValues: { planNote: "", notes: "" },
  });
  useEffect(() => {
    if (report) form.reset({ planNote: report.planNote ?? "", notes: report.notes ?? "" });
    // Chỉ nạp lại khi bản ghi đổi thật (lưu xong) — không đè chữ đang gõ khi refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report?.id, report?.updatedAt]);
  const insight = useWatch({ control: form.control, name: "notes" }) ?? "";

  const saveNotes = useSaveReportNotes(report);
  const finalize = useFinalizeReport(report);
  const del = useDeleteReportDraft(report);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [shareAfterFinalize, setShareAfterFinalize] = useState(false);

  if (wsLoading || reportLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-48 w-full rounded-2xl" />
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
  const subtitle = [
    reportRangeLabel(report.periodType, report.periodStart),
    scopeLabel,
    !report.branchId && branchOptions.length ? `${branchOptions.length} chi nhánh` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const today = todayIso();
  const periodOpen = !isPeriodOver(report.periodType, report.periodStart, today);
  const dueDate = reportDueDate(report.periodType, report.periodStart);

  // Kỳ liền trước, cùng loại kỳ + phạm vi, đã chốt — để so sánh 3 số chính.
  const prevStart = shiftPeriod(report.periodType, report.periodStart, -1);
  const prev = siblings.find(
    (r) =>
      r.status === "final" &&
      r.periodType === report.periodType &&
      r.periodStart === prevStart &&
      r.branchId === report.branchId,
  );
  const previous: PreviousFigures | null = prev
    ? { label: periodLabel(prev.periodType, prev.periodStart), soldValue: prev.soldValue, collected: prev.collected }
    : null;

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
    finalize.mutate(undefined, {
      onSuccess: () => {
        setFinalizeOpen(false);
        setShareAfterFinalize(canShare);
      },
    });
  };
  const onExcel = () => {
    if (!payload) return;
    const name = reportFileName(payload, "xlsx");
    downloadReportXlsx(payload, report.status, isDraft ? name.replace(/\.xlsx$/, "-ban-nhap.xlsx") : name);
  };
  const onPrint = () => window.open(`${reportPrintHref(report.id)}?auto=1`, "_blank", "noopener");

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate(REPORTS_HREF)}>
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
        Báo cáo định kỳ
      </Button>

      <ReportDetailHeader
        title={title}
        status={report.status}
        subtitle={subtitle}
        ready={!!payload}
        canDelete={canEdit}
        onPrint={onPrint}
        onExcel={onExcel}
        onDelete={() => setDeleteOpen(true)}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          {payloadLoading ? (
            <>
              <Skeleton className="h-48 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-48 w-full rounded-2xl" />
            </>
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
            <>
              <ReportConclusionHero payload={payload} />
              <ReportKpiCards payload={payload} previous={previous} />
              <ReportAttentionCard payload={payload} />
              <ReportBranchTable payload={payload} />
            </>
          )}

          <ReportInsightCard
            form={form}
            canEdit={canEdit}
            onSave={() => void onSaveNotes()}
            saving={saveNotes.isPending}
            readOnly={
              isDraft || !payload
                ? { notes: report.notes, planNote: report.planNote }
                : { notes: payload.notes.officer, planNote: payload.notes.plan }
            }
          />

          {payload && <ReportDetailsSection payload={payload} status={report.status} />}
        </div>

        {/* Cột phải — mobile nằm trên nội dung (như design). */}
        <aside className="order-first flex flex-col gap-3 lg:sticky lg:top-4 lg:order-none">
          {isDraft ? (
            <ReportDraftPanel
              asOf={payload?.meta.asOf ?? null}
              hasInsight={!!insight.trim()}
              dueDate={dueDate}
              overdue={today > dueDate}
              action={
                canFinalize
                  ? {
                      label: canShare ? "Chốt & chia sẻ" : "Chốt báo cáo",
                      disabled: !payload,
                      onClick: () => setFinalizeOpen(true),
                    }
                  : null
              }
            />
          ) : (
            <>
              <ReportFinalPanel
                finalizedAt={report.finalizedAt}
                finalizedBy={payload?.people.finalizedBy ?? null}
                preparedBy={payload?.people.preparedBy ?? null}
              />
              <ReportShareCard report={report} canShare={canShare} openOnMount={shareAfterFinalize} />
            </>
          )}
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
