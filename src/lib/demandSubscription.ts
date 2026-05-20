// Demand subscription system. Subscription state persisted in localStorage.
// Credit deduction uses the Supabase-backed credits system.
import { CREDIT_PACKAGES } from "./credits";

const KEY = "demandSubscription.v1";
const EVT = "demandSubscription:change";

export type DemandTierKey = "weekly" | "monthly" | "yearly";

export const DEMAND_TIERS: {
  key: DemandTierKey;
  days: number;
  cost: number;
  label: string;
  shortLabel: string;
  badge?: string;
  savingText?: string;
}[] = [
  { key: "weekly", days: 7, cost: 99, label: "1 tuần", shortLabel: "Tuần" },
  {
    key: "monthly",
    days: 30,
    cost: 299,
    label: "1 tháng",
    shortLabel: "Tháng",
    badge: "Phổ biến",
    savingText: "Tiết kiệm 25%",
  },
  {
    key: "yearly",
    days: 365,
    cost: 1990,
    label: "1 năm",
    shortLabel: "Năm",
    badge: "Tiết kiệm nhất",
    savingText: "Tiết kiệm 45%",
  },
];

export type DemandStatus = "NOT_SUBSCRIBED" | "ACTIVE" | "EXPIRED";

interface StoredState {
  tier: DemandTierKey;
  startedAt: number;
  expiresAt: number;
}

let cached: StoredState | null | undefined;

const read = (): StoredState | null => {
  if (typeof window === "undefined") return null;
  if (cached !== undefined) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as StoredState) : null;
  } catch {
    cached = null;
  }
  return cached;
};

const write = (s: StoredState | null) => {
  cached = s;
  if (typeof window === "undefined") return;
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(EVT));
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) cached = undefined;
  });
}

export const subscribe = (cb: () => void) => {
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  window.addEventListener("storage", handler);
  // Re-evaluate periodically in case it expires
  const interval = window.setInterval(handler, 60_000);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener("storage", handler);
    window.clearInterval(interval);
  };
};

export interface DemandSubscriptionState {
  status: DemandStatus;
  tier: DemandTierKey | null;
  startedAt: number | null;
  expiresAt: number | null;
  daysRemaining: number;
}

let cachedSnapshot: DemandSubscriptionState | null = null;

const computeSnapshot = (): DemandSubscriptionState => {
  const s = read();
  if (!s) return { status: "NOT_SUBSCRIBED", tier: null, startedAt: null, expiresAt: null, daysRemaining: 0 };
  const now = Date.now();
  if (s.expiresAt < now) {
    return { status: "EXPIRED", tier: s.tier, startedAt: s.startedAt, expiresAt: s.expiresAt, daysRemaining: 0 };
  }
  return {
    status: "ACTIVE",
    tier: s.tier,
    startedAt: s.startedAt,
    expiresAt: s.expiresAt,
    daysRemaining: Math.max(1, Math.ceil((s.expiresAt - now) / (24 * 60 * 60 * 1000))),
  };
};

const snapshotsEqual = (a: DemandSubscriptionState, b: DemandSubscriptionState) =>
  a.status === b.status &&
  a.tier === b.tier &&
  a.startedAt === b.startedAt &&
  a.expiresAt === b.expiresAt &&
  a.daysRemaining === b.daysRemaining;

export const getDemandSubscription = (): DemandSubscriptionState => {
  const next = computeSnapshot();
  if (cachedSnapshot && snapshotsEqual(cachedSnapshot, next)) return cachedSnapshot;
  cachedSnapshot = next;
  return cachedSnapshot;
};

export const getState = getDemandSubscription;

// Invalidate cached snapshot whenever underlying state may have changed
const invalidateSnapshot = () => {
  cachedSnapshot = null;
};
if (typeof window !== "undefined") {
  window.addEventListener(EVT, invalidateSnapshot);
  window.addEventListener("storage", invalidateSnapshot);
}

import { supabase } from "@/integrations/supabase/client";
import { fetchCreditState } from "./credits";

export const subscribeDemand = async (
  tierKey: DemandTierKey
): Promise<{ ok: boolean; reason?: "insufficient" | "invalid" }> => {
  const tier = DEMAND_TIERS.find((t) => t.key === tierKey);
  if (!tier) return { ok: false, reason: "invalid" };

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, reason: "insufficient" };

  const state = await fetchCreditState(userId);
  if (state.balance < tier.cost) return { ok: false, reason: "insufficient" };

  // Deduct credits via DB (addCredits with negative amount acts as deduction)
  const { data } = await supabase.from("user_credits").select("balance").eq("user_id", userId).single();
  const current = data?.balance ?? 0;
  await Promise.all([
    supabase.from("user_credits").update({ balance: current - tier.cost, updated_at: new Date().toISOString() }).eq("user_id", userId),
    supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "subscribe_demand",
      description: `Theo dõi nhu cầu ${tier.label}`,
      credit_delta: -tier.cost,
    }),
  ]);

  // Subscription state stays in localStorage (TODO: move to DB in a follow-up task)
  const currentSub = read();
  const now = Date.now();
  const base = currentSub && currentSub.expiresAt > now ? currentSub.expiresAt : now;
  const startedAt = currentSub && currentSub.expiresAt > now ? currentSub.startedAt : now;
  write({
    tier: tierKey,
    startedAt,
    expiresAt: base + tier.days * 24 * 60 * 60 * 1000,
  });

  return { ok: true };
};

export const cancelDemandSubscription = () => write(null);
