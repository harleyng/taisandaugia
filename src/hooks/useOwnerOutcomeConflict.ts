import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invalidateOwnerOutcomes } from "@/hooks/useOwnerOutcomeEdit";

export type ConflictChoice = "keep_mine" | "use_source";

const REASON_MESSAGE: Record<string, string> = {
  not_authorized: "Bạn không có quyền xử lý số liệu của tài sản này (ngoài phạm vi chi nhánh của bạn).",
  no_own_record: "Đơn vị chưa khai kết quả cho lượt này — hãy chọn dùng số của nguồn khác hoặc khai kết quả.",
  platform_disagrees: "Kết quả phiên trên sàn khác số này. Số của sàn là kết quả chính thức — hãy dùng số của sàn.",
  source_changed: "Nguồn này vừa cập nhật số liệu. Mở lại để xem số mới nhất.",
  source_has_no_price: "Nguồn này chưa có giá trúng nên không dùng được.",
  not_in_portfolio: "Tài sản không còn trong danh mục của đơn vị.",
};

/**
 * "Giữ số của tôi" / "Dùng số của tổ chức" — RPC owner_outcome_resolve_conflict.
 * Mọi luật (nguồn nào được bỏ qua, lượt nào) nằm ở server; RPC trả {ok:false,
 * reason} cho thất bại dự kiến nên phải kiểm `ok` (Supabase coi đó là thành công).
 * Không gửi gì cho tổ chức đấu giá.
 */
export function useResolveOutcomeConflict(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { listingId: string; choice: ConflictChoice; sourceFp?: string | null }) => {
      if (!workspaceId) throw new Error("no_workspace");
      const { data, error } = await supabase.rpc("owner_outcome_resolve_conflict", {
        p_workspace_id: workspaceId,
        p_listing_id: input.listingId,
        p_choice: input.choice,
        p_source_fp: input.sourceFp ?? undefined,
      });
      if (error) throw error;
      const res = (data ?? {}) as { ok?: boolean; reason?: string };
      if (!res.ok) throw new Error(REASON_MESSAGE[res.reason ?? ""] ?? "Không xử lý được. Vui lòng thử lại.");
    },
    onSuccess: (_d, { choice }) =>
      toast.success(choice === "keep_mine" ? "Đã giữ số của đơn vị" : "Đã cập nhật theo số đã chọn"),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Không xử lý được. Vui lòng thử lại."),
    onSettled: () => invalidateOwnerOutcomes(queryClient, workspaceId),
  });
}
