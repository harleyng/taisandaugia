import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { qk } from "@/lib/queryKeys";
import { groupPipeline } from "@/lib/ownerPipeline";
import {
  PIPELINE_POSTING_SELECT,
  collectPipelineFacts,
  type PipelinePostingRow,
} from "@/lib/ownerPipelineFacts";
import type { ResolvedAssetOutcome } from "@/lib/ownerOutcomes";
import type { AssetOwnerClaim } from "@/types/asset-owner";

interface UseOwnerPipelineInput {
  /** Claims + kết quả hợp nhất trang đã tải sẵn — không tải lại. */
  claims: AssetOwnerClaim[];
  outcomesByListing: Record<string, ResolvedAssetOutcome | undefined>;
  /** Claims hoặc kết quả còn đang tải (tránh thẻ nhảy vào "Phiên" trước khi có kết quả). */
  loading: boolean;
}

/**
 * Hồ sơ số hoá của tenant hiện tại kèm chuỗi ký gửi / phiên / HĐ mua bán, trong
 * MỘT lượt đọc. Dùng chung cho bảng Tài sản và chế độ Giai đoạn (cùng query key).
 */
export function useOwnerPipelinePostings() {
  const { userId, workspaceId, isPersonal, tenantKey, isLoading: tenantLoading } = useOwnerWorkspace();

  const postings = useQuery({
    queryKey: qk.ownerPipelinePostings(userId, tenantKey),
    enabled: !!userId && !tenantLoading && !!tenantKey,
    staleTime: 60_000,
    queryFn: async (): Promise<PipelinePostingRow[]> => {
      let query = supabase.from("asset_postings").select(PIPELINE_POSTING_SELECT).neq("status", "cancelled");
      // Lọc tường minh như useMyPostings — admin đọc được mọi hồ sơ qua RLS.
      query = isPersonal
        ? query.is("workspace_id", null).eq("user_id", userId!)
        : query.eq("workspace_id", workspaceId!);
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PipelinePostingRow[];
    },
  });

  return { ...postings, isLoading: tenantLoading || postings.isLoading };
}

/**
 * "Đường ống" của tenant hiện tại (Phase 12): tin đã nhận của không gian + hồ sơ
 * số hoá của tenant, mỗi tài sản đúng một cột.
 */
export function useOwnerPipeline({ claims, outcomesByListing, loading }: UseOwnerPipelineInput) {
  const postings = useOwnerPipelinePostings();

  const postingRows = postings.data;
  const collected = useMemo(() => {
    const now = new Date();
    const { facts, pendingClaimCount } = collectPipelineFacts({
      claims,
      outcomesByListing,
      postings: postingRows ?? [],
      now,
    });
    return { board: groupPipeline(facts, now), pendingClaimCount };
  }, [claims, outcomesByListing, postingRows]);

  return {
    ...collected,
    isLoading: loading || postings.isLoading,
    postingsError: postings.isError,
    refetchPostings: postings.refetch,
  };
}
