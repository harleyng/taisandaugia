import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { AssetOwnerWorkspace, AssetOwnerClaim } from "@/types/asset-owner";

// Việc chấm điểm khớp tên nay nằm ở Postgres (org_name_similarity /
// run_workspace_match). Bản client cũ giữ nguyên dấu tiếng Việt nên
// "Vietinbank" không bao giờ khớp "VietinBank – CN Đống Đa", và nó kéo TOÀN BỘ
// bảng asset_owners về trình duyệt mỗi lần khớp. Gợi ý ứng viên chi nhánh nay
// dùng RPC suggest_org_aliases (xem useAliasSuggestion trong useProspects.ts).

export function useAssetOwnerWorkspace(userId: string | null) {
  const queryClient = useQueryClient();
  const wsKey = ["asset_owner_workspace", userId];
  const claimsKey = ["asset_owner_claims", userId];

  const { data: workspace, isLoading: wsLoading } = useQuery<AssetOwnerWorkspace | null>({
    queryKey: wsKey,
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_workspaces")
        .select("*")
        .eq("owner_user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as AssetOwnerWorkspace | null;
    },
  });

  const { data: claims = [], isLoading: claimsLoading } = useQuery<AssetOwnerClaim[]>({
    queryKey: claimsKey,
    enabled: !!workspace?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_owner_claims")
        .select("*, listing:listings(title, price, property_type_slug, image_url, status, address, custom_attributes), asset_owner:asset_owners(name, address)")
        .eq("workspace_id", workspace!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AssetOwnerClaim[];
    },
  });

  // Round count (price sessions) per listing_id
  const listingIds = claims.map((c) => c.listing_id).filter((id): id is string => !!id);
  const { data: roundCountsByListing = {} } = useQuery<Record<string, number>>({
    queryKey: ["asset-owner-round-counts", workspace?.id],
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

  const updateSeeds = useMutation({
    mutationFn: async (seeds: Pick<AssetOwnerWorkspace, "primary_name" | "abbreviations" | "branch_names">) => {
      if (!workspace?.id) throw new Error("no_workspace");
      const { error } = await supabase
        .from("asset_owner_workspaces")
        .update(seeds)
        .eq("id", workspace.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: wsKey }),
    onError: () => toast.error("Cập nhật seed thất bại"),
  });

  /** Khớp tài sản. Seed lấy từ chính workspace (primary_name + abbreviations +
   *  branch_names) ở phía server, nên nhớ updateSeeds trước khi gọi. */
  const runMatch = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error("no_workspace");
      const { data, error } = await supabase.rpc("run_workspace_match", {
        p_workspace_id: workspace.id,
      });
      if (error) throw error;
      return (data ?? { inserted: 0, auto_claimed: 0, pending: 0 }) as unknown as {
        inserted: number; auto_claimed: number; pending: number;
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: claimsKey });
      queryClient.invalidateQueries({ queryKey: wsKey });
      if (result.inserted === 0) {
        toast.info("Không tìm thấy tài sản mới nào khớp với các tên đã khai");
      } else {
        toast.success(
          `Đã khớp thêm ${result.inserted} tài sản (${result.auto_claimed} tự động, ${result.pending} cần xác nhận)`,
        );
      }
    },
    onError: () => toast.error("Khớp tài sản thất bại"),
  });

  const confirmClaim = useMutation({
    mutationFn: async (claimId: string) => {
      const { error } = await supabase
        .from("asset_owner_claims")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", claimId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: claimsKey }),
    onError: () => toast.error("Xác nhận thất bại"),
  });

  const rejectClaim = useMutation({
    mutationFn: async ({ claimId, reason }: { claimId: string; reason?: string }) => {
      const { error } = await supabase
        .from("asset_owner_claims")
        .update({ status: "rejected", rejection_reason: reason ?? null })
        .eq("id", claimId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: claimsKey }),
    onError: () => toast.error("Từ chối thất bại"),
  });

  const confirmAllPending = useMutation({
    mutationFn: async () => {
      if (!workspace?.id) throw new Error("no_workspace");
      const { error } = await supabase
        .from("asset_owner_claims")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("workspace_id", workspace.id)
        .eq("status", "pending_confirmation");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: claimsKey });
      toast.success("Đã xác nhận tất cả");
    },
    onError: () => toast.error("Xác nhận thất bại"),
  });

  return {
    workspace, wsLoading,
    claims, claimsLoading,
    roundCountsByListing,
    updateSeeds, runMatch,
    confirmClaim, rejectClaim, confirmAllPending,
  };
}
