import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { qk } from "@/lib/queryKeys";
import { ownerWsErrorMessage } from "@/lib/ownerWorkspace/errors";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import type { AssetOwnerWorkspace, AssetOwnerClaim } from "@/types/asset-owner";

// Việc chấm điểm khớp tên nay nằm ở Postgres (org_name_similarity /
// run_workspace_match). Bản client cũ giữ nguyên dấu tiếng Việt nên
// "Vietinbank" không bao giờ khớp "VietinBank – CN Đống Đa", và nó kéo TOÀN BỘ
// bảng asset_owners về trình duyệt mỗi lần khớp. Gợi ý ứng viên chi nhánh nay
// dùng RPC suggest_org_aliases (xem useAliasSuggestion trong useProspects.ts).
//
// Không gian lấy từ useOwnerWorkspace (bảng thành viên), không còn theo
// owner_user_id — thành viên được mời dùng chung hook này. Quyền ghi do RLS
// quyết định theo vai trò (migration 20260926140447).

export function useAssetOwnerWorkspace() {
  const queryClient = useQueryClient();
  const { userId, workspace, workspaceId, isLoading: wsLoading } = useOwnerWorkspace();
  const claimsKey = qk.ownerWorkspace.claims(workspaceId);

  const { data: claims = [], isLoading: claimsLoading } = useQuery<AssetOwnerClaim[]>({
    queryKey: claimsKey,
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_claims")
        .select("*, listing:listings(title, price, property_type_slug, image_url, status, address, custom_attributes, created_at), asset_owner:asset_owners(name, address)")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssetOwnerClaim[];
    },
  });

  // Round count (price sessions) per listing_id
  const listingIds = claims.map((c) => c.listing_id).filter((id): id is string => !!id);
  const { data: roundCountsByListing = {} } = useQuery<Record<string, number>>({
    queryKey: ["asset-owner-round-counts", workspaceId],
    enabled: listingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_price_sessions")
        .select("listing_id")
        .in("listing_id", listingIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.listing_id] = (counts[row.listing_id] ?? 0) + 1;
      }
      return counts;
    },
    staleTime: 2 * 60_000,
  });

  /** Dòng workspace nằm trong danh sách thành viên-của-tôi ⇒ làm mới ở đó. */
  const invalidateWorkspace = () =>
    queryClient.invalidateQueries({ queryKey: qk.ownerWorkspace.memberships(userId) });

  /** Claims đổi ⇒ cả KPI "Nhịp đập" lẫn khối "chờ xác nhận" trên dashboard cũng đổi. */
  const invalidateClaims = () => {
    queryClient.invalidateQueries({ queryKey: claimsKey });
    queryClient.invalidateQueries({ queryKey: qk.ownerPortfolioClaims(workspaceId) });
    queryClient.invalidateQueries({ queryKey: ["pending-claims-dashboard", workspaceId] });
  };

  const updateSeeds = useMutation({
    mutationFn: async (seeds: Pick<AssetOwnerWorkspace, "primary_name" | "abbreviations" | "branch_names">) => {
      if (!workspaceId) throw new Error("no_workspace");
      const { error } = await supabase
        .from("asset_owner_workspaces")
        .update(seeds)
        .eq("id", workspaceId);
      if (error) throw error;
    },
    onSuccess: invalidateWorkspace,
    onError: (err) => toast.error("Cập nhật seed thất bại", { description: ownerWsErrorMessage(err) }),
  });

  /** Khớp tài sản. Seed lấy từ chính workspace (primary_name + abbreviations +
   *  branch_names) ở phía server, nên nhớ updateSeeds trước khi gọi. */
  const runMatch = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("no_workspace");
      const { data, error } = await supabase.rpc("run_workspace_match", {
        p_workspace_id: workspaceId,
      });
      if (error) throw error;
      return (data ?? { inserted: 0, auto_claimed: 0, pending: 0 }) as unknown as {
        inserted: number; auto_claimed: number; pending: number;
      };
    },
    onSuccess: (result) => {
      invalidateClaims();
      invalidateWorkspace();
      if (result.inserted === 0) {
        toast.info("Không tìm thấy tài sản mới nào khớp với các tên đã khai");
      } else {
        toast.success(
          `Đã khớp thêm ${result.inserted} tài sản (${result.auto_claimed} tự động, ${result.pending} cần xác nhận)`,
        );
      }
    },
    onError: (err) => toast.error("Khớp tài sản thất bại", { description: ownerWsErrorMessage(err) }),
  });

  const confirmClaim = useMutation({
    mutationFn: async (claimId: string) => {
      const { error } = await supabase
        .from("asset_owner_claims")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString(), confirmed_by: userId })
        .eq("id", claimId);
      if (error) throw error;
    },
    onSuccess: invalidateClaims,
    onError: (err) => toast.error("Xác nhận thất bại", { description: ownerWsErrorMessage(err) }),
  });

  const rejectClaim = useMutation({
    mutationFn: async ({ claimId, reason }: { claimId: string; reason?: string }) => {
      const { error } = await supabase
        .from("asset_owner_claims")
        .update({ status: "rejected", rejection_reason: reason ?? null })
        .eq("id", claimId);
      if (error) throw error;
    },
    onSuccess: invalidateClaims,
    onError: (err) => toast.error("Từ chối thất bại", { description: ownerWsErrorMessage(err) }),
  });

  const confirmAllPending = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("no_workspace");
      const { error } = await supabase
        .from("asset_owner_claims")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString(), confirmed_by: userId })
        .eq("workspace_id", workspaceId)
        .eq("status", "pending_confirmation");
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateClaims();
      toast.success("Đã xác nhận tất cả");
    },
    onError: (err) => toast.error("Xác nhận thất bại", { description: ownerWsErrorMessage(err) }),
  });

  return {
    workspace, wsLoading,
    claims, claimsLoading,
    roundCountsByListing,
    updateSeeds, runMatch,
    confirmClaim, rejectClaim, confirmAllPending,
  };
}
