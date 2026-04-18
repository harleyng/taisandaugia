import { useSyncExternalStore, useCallback } from "react";
import {
  ASSET_COST,
  COMPANY_TIERS,
  OWNER_TIERS,
  CREDIT_PACKAGES,
  CompanyTierKey,
  OwnerTierKey,
  CreditPackageKey,
  Transaction,
  addCredits as addCreditsImpl,
  getCompanyAccess,
  getOwnerAccess,
  getState,
  isAssetUnlocked,
  subscribe,
  unlockAsset as unlockAssetImpl,
  lockAsset as lockAssetImpl,
  unlockCompany as unlockCompanyImpl,
  unlockOwner as unlockOwnerImpl,
} from "@/lib/mockCredits";

export const useCredits = () => {
  const state = useSyncExternalStore(
    subscribe,
    () => getState(),
    () => getState()
  );

  const assetUnlocked = useCallback((id: string) => state.assetUnlocks.includes(id), [state]);
  const companyAccess = useCallback((orgId: string) => getCompanyAccess(orgId), [state]);
  const ownerAccess = useCallback((ownerId: string) => getOwnerAccess(ownerId), [state]);
  const unlockAsset = useCallback((id: string, label?: string) => unlockAssetImpl(id, label), []);
  const lockAsset = useCallback((id: string) => lockAssetImpl(id), []);
  const unlockCompany = useCallback(
    (orgId: string, tier: CompanyTierKey, label?: string) => unlockCompanyImpl(orgId, tier, label),
    []
  );
  const unlockOwner = useCallback(
    (ownerId: string, tier: OwnerTierKey, label?: string) => unlockOwnerImpl(ownerId, tier, label),
    []
  );
  const addCredits = useCallback(
    (credits: number, packageKey?: CreditPackageKey, priceVnd?: number) => addCreditsImpl(credits, packageKey, priceVnd),
    []
  );

  return {
    balance: state.balance,
    transactions: state.transactions,
    assetUnlocked,
    companyAccess,
    ownerAccess,
    unlockAsset,
    lockAsset,
    unlockCompany,
    unlockOwner,
    addCredits,
    ASSET_COST,
    COMPANY_TIERS,
    OWNER_TIERS,
    CREDIT_PACKAGES,
  };
};

export { ASSET_COST, COMPANY_TIERS, OWNER_TIERS, CREDIT_PACKAGES };
export type { CompanyTierKey, OwnerTierKey, CreditPackageKey, Transaction };
