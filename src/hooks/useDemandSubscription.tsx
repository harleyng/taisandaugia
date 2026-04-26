import { useSyncExternalStore, useCallback } from "react";
import {
  DEMAND_TIERS,
  DemandTierKey,
  getState,
  subscribe,
  subscribeDemand as subscribeDemandImpl,
  cancelDemandSubscription as cancelImpl,
} from "@/lib/demandSubscription";

export const useDemandSubscription = () => {
  const state = useSyncExternalStore(subscribe, getState, getState);
  const subscribeDemand = useCallback((tier: DemandTierKey) => subscribeDemandImpl(tier), []);
  const cancel = useCallback(() => cancelImpl(), []);
  return { ...state, subscribeDemand, cancel, DEMAND_TIERS };
};

export { DEMAND_TIERS };
export type { DemandTierKey };
