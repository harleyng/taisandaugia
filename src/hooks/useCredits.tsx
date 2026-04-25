import { useSyncExternalStore, useCallback } from "react";
import {
  ASSET_COST,
  COMPANY_TIERS,
  OWNER_TIERS,
  CREDIT_PACKAGES,
  DEEP_REPORT_PERIOD_PRICES,
  CompanyTierKey,
  OwnerTierKey,
  CreditPackageKey,
  Transaction,
  addCredits as addCreditsImpl,
  getCompanyAccess,
  getOwnerAccess,
  getState,
  isAssetUnlocked,
  isDeepReportPeriodUnlocked as isDeepReportPeriodUnlockedImpl,
  getUnlockedPeriodsForReport as getUnlockedPeriodsForReportImpl,
  subscribe,
  unlockAsset as unlockAssetImpl,
  lockAsset as lockAssetImpl,
  unlockCompany as unlockCompanyImpl,
  unlockOwner as unlockOwnerImpl,
  unlockDeepReportPeriod as unlockDeepReportPeriodImpl,
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
  const isReportPeriodUnlocked = useCallback(
    (slug: string, periodId: string) => isDeepReportPeriodUnlockedImpl(slug, periodId),
    [state]
  );
  const getUnlockedPeriodsForReport = useCallback(
    (slug: string) => getUnlockedPeriodsForReportImpl(slug),
    [state]
  );
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
  const unlockDeepReportPeriod = useCallback(
    (slug: string, periodId: string, label?: string) =>
      unlockDeepReportPeriodImpl(slug, periodId, label),
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
    isReportPeriodUnlocked,
    getUnlockedPeriodsForReport,
    unlockAsset,
    lockAsset,
    unlockCompany,
    unlockOwner,
    unlockDeepReportPeriod,
    addCredits,
    ASSET_COST,
    COMPANY_TIERS,
    OWNER_TIERS,
    CREDIT_PACKAGES,
    DEEP_REPORT_PERIOD_PRICES,
  };
};

export { ASSET_COST, COMPANY_TIERS, OWNER_TIERS, CREDIT_PACKAGES, DEEP_REPORT_PERIOD_PRICES };
export type { CompanyTierKey, OwnerTierKey, CreditPackageKey, Transaction };
