import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import {
  assertOwnerReportRpcOk,
  mapReportListRow,
  mapReportPayload,
  mapReportRow,
  noteOrNull,
  reportErrorMessage,
  toReportInsert,
  withDraftNotes,
  type CreateReportForm,
  type OwnerReport,
  type OwnerReportListItem,
  type ReportNotesForm,
  type ReportPayload,
} from "@/lib/ownerPeriodicReport";

// Báo cáo định kỳ (docs/owner-control-tower-plan.md Phase 10). Client KHÔNG gửi số
// liệu: bản nháp đọc RPC owner_build_report_payload; chốt = RPC owner_finalize_report
// (server tự dựng + đóng băng). Bảng chỉ cho client ghi kỳ / phạm vi / ghi chú.

// LUÔN liệt kê cột: authenticated không có quyền đọc share_token (Phase 11) nên select("*")
// trên bảng này bị từ chối. Trạng thái link (hạn, lượt xem) thì ai đọc được báo cáo cũng thấy.
const BASE_COLUMNS =
  "id, workspace_id, branch_id, period_type, period_start, status, notes, plan_note, finalized_at, finalized_by, created_by, created_at, updated_at, token_expires_at, view_count, last_viewed_at, shared_at, shared_by";

// Danh sách không tải cả payload (có thể vài trăm KB/báo cáo năm) — chỉ vài trường tóm tắt.
// Kiểu `string` (không phải literal): bộ phân tích select của postgrest-js không chịu
// nổi đường dẫn JSON (TS2589) ⇒ tự khai kiểu dòng ở ListRow.
const LIST_COLUMNS: string = `${BASE_COLUMNS}, scope:payload->meta->scope, people:payload->people, collected:payload->money->collected, sold_count:payload->money->sold_count`;

type ListRow = Parameters<typeof mapReportListRow>[0];

const NO_REPORTS: OwnerReportListItem[] = [];

export function useOwnerReports(workspaceId: string | null | undefined) {
  const query = useQuery({
    queryKey: qk.ownerReports(workspaceId),
    enabled: !!workspaceId,
    queryFn: async (): Promise<OwnerReportListItem[]> => {
      const { data, error } = await supabase
        .from("owner_report_snapshots")
        .select(LIST_COLUMNS)
        .eq("workspace_id", workspaceId!)
        .order("period_start", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as ListRow[]).flatMap((row) => {
        const item = mapReportListRow(row);
        return item ? [item] : [];
      });
    },
  });
  return {
    reports: query.data ?? NO_REPORTS,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/** Một báo cáo theo id — RLS quyết định xem được không (thành viên của không gian của báo cáo). */
export function useOwnerReport(reportId: string | null | undefined) {
  return useQuery({
    queryKey: qk.ownerReport(reportId),
    enabled: !!reportId,
    queryFn: async (): Promise<OwnerReport | null> => {
      const { data, error } = await supabase
        .from("owner_report_snapshots")
        .select(`${BASE_COLUMNS}, payload`)
        .eq("id", reportId!)
        .maybeSingle();
      if (error) throw error;
      return data ? mapReportRow(data) : null;
    },
  });
}

/**
 * Số liệu để hiển thị / in / xuất Excel.
 * Đã chốt ⇒ payload đóng băng. Nháp ⇒ tính trực tiếp mỗi lần mở (staleTime 0) và
 * ghép ghi chú đang lưu — key nằm dưới ownerAssetOutcomes nên sửa kết quả là tự tính lại.
 */
export function useOwnerReportPayload(report: OwnerReport | null | undefined) {
  const isDraft = report?.status === "draft";
  const preview = useQuery({
    queryKey: qk.ownerReportPreview(report?.workspaceId, report?.periodType, report?.periodStart, report?.branchId),
    enabled: !!report && isDraft,
    staleTime: 0,
    queryFn: async (): Promise<ReportPayload | null> => {
      const { data, error } = await supabase.rpc("owner_build_report_payload", {
        p_workspace_id: report!.workspaceId,
        p_period_type: report!.periodType,
        p_period_start: report!.periodStart,
        p_branch_id: report!.branchId ?? undefined,
      });
      if (error) throw error;
      return mapReportPayload(data);
    },
  });

  const payload = useMemo<ReportPayload | null>(() => {
    if (!report) return null;
    if (report.status === "final") return mapReportPayload(report.payload);
    return preview.data ? withDraftNotes(preview.data, report) : null;
  }, [report, preview.data]);

  return {
    payload,
    isLoading: isDraft && preview.isLoading,
    isError: isDraft && preview.isError,
    refetch: preview.refetch,
  };
}

function useInvalidateReports() {
  const queryClient = useQueryClient();
  return (workspaceId: string, reportId?: string) => {
    void queryClient.invalidateQueries({ queryKey: qk.ownerReports(workspaceId) });
    if (reportId) void queryClient.invalidateQueries({ queryKey: qk.ownerReport(reportId) });
  };
}

/** "Tạo bản nháp" ⇒ trả id để mở trang chi tiết. */
export function useCreateReportDraft(workspaceId: string | null | undefined) {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: async (form: CreateReportForm): Promise<string> => {
      if (!workspaceId) throw new Error("no_workspace");
      const { data, error } = await supabase
        .from("owner_report_snapshots")
        .insert(toReportInsert(form, workspaceId))
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => toast.success("Đã tạo bản nháp báo cáo"),
    onError: (err) => toast.error(reportErrorMessage(err, "Không tạo được báo cáo. Vui lòng thử lại.")),
    onSettled: () => workspaceId && invalidate(workspaceId),
  });
}

/**
 * Lưu "Kế hoạch kỳ tới" + "Ghi chú của cán bộ" của bản nháp. RLS lọc dòng không có
 * quyền (hoặc đã chốt) mà không báo lỗi ⇒ đọc lại id để biết có thật sự ghi được không.
 */
export function useSaveReportNotes(report: OwnerReport | null | undefined) {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: async (form: ReportNotesForm) => {
      if (!report) throw new Error("no_report");
      const { data, error } = await supabase
        .from("owner_report_snapshots")
        .update({ notes: noteOrNull(form.notes), plan_note: noteOrNull(form.planNote) })
        .eq("id", report.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw { code: "42501" };
    },
    onSuccess: () => toast.success("Đã lưu ghi chú"),
    onError: (err) => toast.error(reportErrorMessage(err, "Không lưu được ghi chú. Vui lòng thử lại.")),
    onSettled: () => report && invalidate(report.workspaceId, report.id),
  });
}

export function useDeleteReportDraft(report: OwnerReport | null | undefined) {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: async () => {
      if (!report) throw new Error("no_report");
      const { data, error } = await supabase
        .from("owner_report_snapshots")
        .delete()
        .eq("id", report.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw { code: "42501" };
    },
    onSuccess: () => toast.success("Đã xoá bản nháp"),
    onError: (err) => toast.error(reportErrorMessage(err, "Không xoá được bản nháp. Vui lòng thử lại.")),
    onSettled: () => report && invalidate(report.workspaceId),
  });
}

/** "Chốt báo cáo" — chỉ Trưởng đơn vị; server dựng lại số liệu và đóng băng. */
export function useFinalizeReport(report: OwnerReport | null | undefined) {
  const invalidate = useInvalidateReports();
  return useMutation({
    mutationFn: async () => {
      if (!report) throw new Error("no_report");
      const { data, error } = await supabase.rpc("owner_finalize_report", { p_report_id: report.id });
      if (error) throw error;
      assertOwnerReportRpcOk(data);
    },
    onSuccess: () => toast.success("Đã chốt báo cáo — số liệu đã được đóng băng"),
    onError: (err) => toast.error(reportErrorMessage(err, "Không chốt được báo cáo. Vui lòng thử lại.")),
    onSettled: () => report && invalidate(report.workspaceId, report.id),
  });
}
