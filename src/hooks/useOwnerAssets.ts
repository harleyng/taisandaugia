import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerConsignmentSummary } from "@/hooks/useConsignmentContract";
import { useOwnerPipelinePostings } from "@/hooks/useOwnerPipeline";
import { useClaimWriteAccess, useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { qk } from "@/lib/queryKeys";
import { buildOwnerAssets } from "@/lib/ownerAssets";
import type { ResolvedAssetOutcome } from "@/lib/ownerOutcomes";
import type { PipelinePostingRow } from "@/lib/ownerPipelineFacts";
import type { AssetOwnerClaim } from "@/types/asset-owner";

interface UseOwnerAssetsInput {
  /** Claims + số vòng + kết quả trang đã tải sẵn (useAssetOwnerWorkspace / useOwnerAssetOutcomes). */
  claims: AssetOwnerClaim[];
  roundCountsByListing: Record<string, number>;
  outcomesByListing: Record<string, ResolvedAssetOutcome | undefined>;
  loading: boolean;
}

interface BranchNames {
  byId: Record<string, string>;
  byOwner: Record<string, string>;
}

/** Tên chi nhánh của không gian — theo id (hồ sơ số hoá) và theo asset_owner (tin đã nhận). */
function useBranchNames(workspaceId: string | null) {
  return useQuery({
    queryKey: [...qk.ownerWorkspace.all(workspaceId), "branch-names"],
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<BranchNames> => {
      const { data, error } = await supabase
        .from("workspace_branches")
        .select("id, asset_owner_id, display_name, asset_owner:asset_owners(name)")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;
      const out: BranchNames = { byId: {}, byOwner: {} };
      for (const b of data ?? []) {
        const name = b.display_name || (b.asset_owner as { name: string } | null)?.name;
        if (!name) continue;
        out.byId[b.id] = name;
        if (b.asset_owner_id) out.byOwner[b.asset_owner_id] = name;
      }
      return out;
    },
  });
}

/** Dòng bảng "Tài sản": tin đã nhận + hồ sơ số hoá, kèm tin sàn tìm thấy chờ xác nhận. */
export function useOwnerAssets({ claims, roundCountsByListing, outcomesByListing, loading }: UseOwnerAssetsInput) {
  const { workspaceId, canWritePosting } = useOwnerWorkspace();
  const { canWriteClaim } = useClaimWriteAccess();
  const postings = useOwnerPipelinePostings();
  const branches = useBranchNames(workspaceId);
  const { data: consignment } = useOwnerConsignmentSummary();

  const postingRows = postings.data;
  const branchNames = branches.data;
  const consignmentByPosting = consignment?.byPosting;

  const data = useMemo(
    () =>
      buildOwnerAssets({
        claims,
        outcomesByListing,
        postings: postingRows ?? [],
        roundCountsByListing,
        branchNameById: branchNames?.byId ?? {},
        branchNameByOwner: branchNames?.byOwner ?? {},
        consignmentByPosting: consignmentByPosting ?? {},
        canWriteClaim,
        canWritePosting: (p: PipelinePostingRow) =>
          canWritePosting({ workspace_id: p.workspace_id ?? null, branch_id: p.branch_id ?? null, user_id: p.user_id ?? "" }),
      }),
    [claims, outcomesByListing, postingRows, roundCountsByListing, branchNames, consignmentByPosting, canWriteClaim, canWritePosting],
  );

  return {
    ...data,
    isLoading: loading || postings.isLoading,
    postingsError: postings.isError,
    refetchPostings: postings.refetch,
  };
}
