import { useSyncExternalStore, useCallback } from "react";
import {
  ASSET_COST,
  COMPANY_TIERS,
  CREDIT_PACKAGES,
  CompanyTierKey,
  CreditPackageKey,
  Transaction,
  addCredits as addCreditsImpl,
  getCompanyAccess,
  getState,
  isAssetUnlocked,
  subscribe,
  unlockAsset as unlockAssetImpl,
  unlockCompany as unlockCompanyImpl,
} from "@/lib/mockCredits";

export const useCredits = () => {
  const state = useSyncExternalStore(
    subscribe,
    () => getState(),
    () => getState()
  );

  const assetUnlocked = useCallback((id: string) => state.assetUnlocks.includes(id), [state]);
  const companyAccess = useCallback((orgId: string) => getCompanyAccess(orgId), [state]);
  const unlockAsset = useCallback((id: string, label?: string) => unlockAssetImpl(id, label), []);
  const unlockCompany = useCallback(
    (orgId: string, tier: CompanyTierKey, label?: string) => unlockCompanyImpl(orgId, tier, label),
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
    unlockAsset,
    unlockCompany,
    addCredits,
    ASSET_COST,
    COMPANY_TIERS,
    CREDIT_PACKAGES,
  };
};

export { ASSET_COST, COMPANY_TIERS, CREDIT_PACKAGES };
export type { CompanyTierKey, CreditPackageKey, Transaction };
