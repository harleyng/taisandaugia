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
 * và khối "Việc cần làm" trên Tổng quan (cùng cache React Query nên không tải hai lần).
 * `canWrite` chỉ để ẩn nút (khai kết quả = ket-qua:update, thu tiền = thu-tien:create);
 * RLS của owner_asset_outcomes / owner_cash_events mới là cổng thật.
 */
export function useOwnerPulse() {
  const { workspaceId, isScoped: branchScoped } = useOwnerWorkspace();
  const { canOnClaim } = useClaimWriteAccess();
  const { metrics, isLoading } = useOwnerPortfolioMetrics(workspaceId, {});
  const { byListing } = useOwnerAssetOutcomes(workspaceId);

  const allListings = metrics.allListings;

  const outcomeDue = useMemo<OutcomeDueCard[]>(
    () =>
      applyPulseAccess(
        selectOutcomeDue(allListings, byListing),
        (assetOwnerId) => canOnClaim("ket-qua", "update", { asset_owner_id: assetOwnerId }),
        branchScoped,
      ),
    [allListings, byListing, canOnClaim, branchScoped],
  );

  const awaitingPayment = useMemo<AwaitingPaymentCard[]>(
    () =>
      applyPulseAccess(
        selectAwaitingPayment(allListings, byListing),
        (assetOwnerId) => canOnClaim("thu-tien", "create", { asset_owner_id: assetOwnerId }),
        branchScoped,
      ),
    [allListings, byListing, canOnClaim, branchScoped],
  );

  return {
    workspaceId,
    metrics,
    outcomeDue,
    awaitingPayment,
    isLoading,
  };
}
