import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import { assertOwnerReportRpcOk, reportErrorMessage, type OwnerReport } from "@/lib/ownerPeriodicReport";
import {
  mapShareLink,
  mapShareResult,
  mapSharedReportResponse,
  sharedReportUrl,
  type ShareDuration,
  type ShareLink,
  type SharedReportResult,
} from "@/lib/ownerReportShare";

// Link chia sẻ báo cáo định kỳ /r/:token (docs/owner-control-tower-plan.md Phase 11).
// Token KHÔNG đọc được qua bảng (quyền SELECT theo cột) — chỉ qua các RPC dưới đây,
// và chỉ Trưởng đơn vị ('send_report') gọi được.

/** Sao chép link; false khi trình duyệt chặn (người dùng vẫn còn nút sao chép trên thẻ). */
export async function copyShareLink(token: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(sharedReportUrl(token));
    return true;
  } catch {
    return false;
  }
}

/** Token của link còn hạn — chỉ bật cho Trưởng đơn vị (server trả forbidden cho người khác). */
export function useReportShareLink(report: OwnerReport | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.ownerReportShareLink(report?.id),
    enabled: !!report && enabled,
    queryFn: async (): Promise<ShareLink> => {
      const { data, error } = await supabase.rpc("owner_report_share_link", { p_report_id: report!.id });
      if (error) throw error;
      assertOwnerReportRpcOk(data);
      return mapShareLink(data);
    },
  });
}

function useInvalidateShare(report: OwnerReport | null | undefined) {
  const queryClient = useQueryClient();
  return () => {
    if (!report) return;
    void queryClient.invalidateQueries({ queryKey: qk.ownerReport(report.id) });
    void queryClient.invalidateQueries({ queryKey: qk.ownerReports(report.workspaceId) });
  };
}

/** "Tạo link" / "Gia hạn" — link còn hạn thì giữ token, chỉ dời hạn. Tạo mới ⇒ tự sao chép. */
export function useShareReport(report: OwnerReport | null | undefined) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateShare(report);
  return useMutation({
    mutationFn: async (days: ShareDuration) => {
      if (!report) throw new Error("no_report");
      const { data, error } = await supabase.rpc("owner_share_report", { p_report_id: report.id, p_days: days });
      if (error) throw error;
      assertOwnerReportRpcOk(data);
      return mapShareResult(data);
    },
    onSuccess: async (res) => {
      if (report) {
        queryClient.setQueryData<ShareLink>(qk.ownerReportShareLink(report.id), {
          token: res.token,
          expiresAt: res.expiresAt,
        });
      }
      if (res.renewed) {
        toast.success("Đã gia hạn link — link đã gửi vẫn mở được");
        return;
      }
      const copied = await copyShareLink(res.token);
      toast.success(copied ? "Đã tạo link và sao chép — dán vào email hoặc tin nhắn gửi trụ sở" : "Đã tạo link chia sẻ");
    },
    onError: (err) => toast.error(reportErrorMessage(err, "Không tạo được link. Vui lòng thử lại.")),
    onSettled: invalidate,
  });
}

/** "Thu hồi" — link cũ mở ra thông báo "không còn hiệu lực"; lượt xem cũ vẫn giữ. */
export function useRevokeReportShare(report: OwnerReport | null | undefined) {
  const invalidate = useInvalidateShare(report);
  return useMutation({
    mutationFn: async () => {
      if (!report) throw new Error("no_report");
      const { data, error } = await supabase.rpc("owner_revoke_report_share", { p_report_id: report.id });
      if (error) throw error;
      assertOwnerReportRpcOk(data);
    },
    onSuccess: () => toast.success("Đã thu hồi link — người có link sẽ không mở được nữa"),
    onError: (err) => toast.error(reportErrorMessage(err, "Không thu hồi được link. Vui lòng thử lại.")),
    onSettled: invalidate,
  });
}

/**
 * Trang công khai /r/:token (anon). Mỗi lần gọi RPC là một lượt xem ⇒ gọi đúng MỘT lần:
 * không refetch khi focus / reconnect / mount lại, không retry.
 */
export function useSharedOwnerReport(token: string | undefined) {
  return useQuery({
    queryKey: qk.sharedOwnerReport(token),
    enabled: !!token,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async (): Promise<SharedReportResult> => {
      const { data, error } = await supabase.rpc("get_shared_owner_report", { p_token: token! });
      if (error) throw error;
      return mapSharedReportResponse(data);
    },
  });
}
