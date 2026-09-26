import { useMemo } from "react";
import { useOwnerPortfolioMetrics } from "@/hooks/useOwnerPortfolioMetrics";
import { useOwnerAssetOutcomes } from "@/hooks/useOwnerAssetOutcomes";
import { useClaimWriteAccess, useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import {
  applyPulseAccess,
  selectAwaitingPayment,
  selectOutcomeDue,
  type AwaitingPaymentItem,
  type OutcomeDueItem,
  type WithAccess,
} from "@/lib/ownerPulse";

export type OutcomeDueCard = WithAccess<OutcomeDueItem>;
export type AwaitingPaymentCard = WithAccess<AwaitingPaymentItem>;

/**
 * Việc cần làm của "Nhịp đập" cho không gian hiện tại — dùng chung cho trang
 * và huy hiệu ở sidebar (cùng cache React Query nên không tải hai lần).
 * `canWrite` chỉ để ẩn nút; RLS của owner_asset_outcomes mới là cổng thật.
 */
export function useOwnerPulse() {
  const { workspaceId, role, branchScope, can } = useOwnerWorkspace();
  const { canWriteClaim } = useClaimWriteAccess();
  const { metrics, isLoading } = useOwnerPortfolioMetrics(workspaceId, {});
  const { byListing } = useOwnerAssetOutcomes(workspaceId);

  const branchScoped = role === "staff" && branchScope != null;
  const allListings = metrics.allListings;

  const outcomeDue = useMemo<OutcomeDueCard[]>(
    () =>
      applyPulseAccess(
        selectOutcomeDue(allListings, byListing),
        (assetOwnerId) => canWriteClaim({ asset_owner_id: assetOwnerId }),
        branchScoped,
      ),
    [allListings, byListing, canWriteClaim, branchScoped],
  );

  const awaitingPayment = useMemo<AwaitingPaymentCard[]>(
    () =>
      applyPulseAccess(
        selectAwaitingPayment(allListings, byListing),
        (assetOwnerId) => canWriteClaim({ asset_owner_id: assetOwnerId }),
        branchScoped,
      ),
    [allListings, byListing, canWriteClaim, branchScoped],
  );

  return {
    workspaceId,
    metrics,
    outcomeDue,
    awaitingPayment,
    /** Huy hiệu "Nhịp đập": chỉ người khai được mới thấy số việc. */
    outcomeDueBadge: can("write") ? outcomeDue.length : 0,
    isLoading,
  };
}
