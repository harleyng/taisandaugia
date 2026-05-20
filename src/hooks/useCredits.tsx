import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ASSET_COST,
  COMPANY_TIERS,
  OWNER_TIERS,
  CREDIT_PACKAGES,
  DEEP_REPORT_PERIOD_PRICES,
  fetchCreditState,
  deriveCompanyAccess,
  deriveOwnerAccess,
  addCredits as addCreditsImpl,
  unlockAsset as unlockAssetImpl,
  unlockCompany as unlockCompanyImpl,
  unlockOwner as unlockOwnerImpl,
  unlockDeepReportPeriod as unlockDeepReportPeriodImpl,
  type CompanyTierKey,
  type OwnerTierKey,
  type CreditPackageKey,
  type Transaction,
} from "@/lib/credits";

export const useCredits = () => {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const qc = useQueryClient();
  const queryKey = ["user-credits", userId];

  const { data: creditsState, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchCreditState(userId!),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey });
  }, [qc, userId]);

  const unlockAsset = useCallback(
    async (id: string, label?: string) => {
      if (!userId) return { ok: false, reason: "insufficient" as const };
      const result = await unlockAssetImpl(userId, id, label);
      if (result.ok) invalidate();
      return result;
    },
    [userId, invalidate],
  );

  const lockAsset = useCallback(
    async (_id: string) => {
      // Debug-only: no-op in DB mode (would require a DELETE + credit refund)
    },
    [],
  );

  const unlockCompany = useCallback(
    async (orgId: string, tier: CompanyTierKey, label?: string) => {
      if (!userId) return { ok: false, reason: "insufficient" as const };
      const result = await unlockCompanyImpl(userId, orgId, tier, label);
      if (result.ok) invalidate();
      return result;
    },
    [userId, invalidate],
  );

  const unlockOwner = useCallback(
    async (ownerId: string, tier: OwnerTierKey, label?: string) => {
      if (!userId) return { ok: false, reason: "insufficient" as const };
      const result = await unlockOwnerImpl(userId, ownerId, tier, label);
      if (result.ok) invalidate();
      return result;
    },
    [userId, invalidate],
  );

  const unlockDeepReportPeriod = useCallback(
    async (slug: string, periodId: string, label?: string) => {
      if (!userId) return { ok: false, reason: "insufficient" as const };
      const result = await unlockDeepReportPeriodImpl(userId, slug, periodId, label);
      if (result.ok) invalidate();
      return result;
    },
    [userId, invalidate],
  );

  const addCredits = useCallback(
    async (credits: number, packageKey?: CreditPackageKey) => {
      if (!userId) return;
      await addCreditsImpl(userId, credits, packageKey);
      invalidate();
    },
    [userId, invalidate],
  );

  const assetUnlocked = useCallback(
    (id: string) => creditsState?.assetUnlocks.includes(id) ?? false,
    [creditsState],
  );

  const companyAccess = useCallback(
    (orgId: string) => deriveCompanyAccess(creditsState, orgId),
    [creditsState],
  );

  const ownerAccess = useCallback(
    (ownerId: string) => deriveOwnerAccess(creditsState, ownerId),
    [creditsState],
  );

  const isReportPeriodUnlocked = useCallback(
    (slug: string, periodId: string) =>
      creditsState?.reportUnlocks.includes(`${slug}:${periodId}`) ?? false,
    [creditsState],
  );

  const getUnlockedPeriodsForReport = useCallback(
    (slug: string) =>
      (creditsState?.reportUnlocks ?? [])
        .filter((k) => k.startsWith(`${slug}:`))
        .map((k) => k.slice(slug.length + 1)),
    [creditsState],
  );

  return {
    balance: creditsState?.balance ?? 0,
    transactions: creditsState?.transactions ?? [],
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
    isLoading,
    ASSET_COST,
    COMPANY_TIERS,
    OWNER_TIERS,
    CREDIT_PACKAGES,
    DEEP_REPORT_PERIOD_PRICES,
  };
};

export { ASSET_COST, COMPANY_TIERS, OWNER_TIERS, CREDIT_PACKAGES, DEEP_REPORT_PERIOD_PRICES };
export type { CompanyTierKey, OwnerTierKey, CreditPackageKey, Transaction };
