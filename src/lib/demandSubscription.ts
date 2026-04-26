// Mock demand subscription system. Persisted in localStorage.
// Trừ credit từ mockCredits khi đăng ký.
import { CREDIT_PACKAGES } from "./mockCredits";

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

// Imports: lấy mockCredits read/write trực tiếp để trừ + log transaction.
import {
  getState as getCreditsState,
} from "./mockCredits";

// Để giữ tách biệt, ta thao tác qua localStorage của mockCredits.
const CREDITS_KEY = "mockCredits.v1";
const CREDITS_EVT = "mockCredits:change";

interface MockCreditsRaw {
  balance: number;
  transactions: { id: string; type: string; description: string; creditDelta: number; at: number }[];
  [k: string]: unknown;
}

const readCredits = (): MockCreditsRaw | null => {
  try {
    const raw = localStorage.getItem(CREDITS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MockCreditsRaw;
  } catch {
    return null;
  }
};

const writeCredits = (s: MockCreditsRaw) => {
  localStorage.setItem(CREDITS_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent(CREDITS_EVT));
};

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const subscribeDemand = (
  tierKey: DemandTierKey
): { ok: boolean; reason?: "insufficient" | "invalid" } => {
  const tier = DEMAND_TIERS.find((t) => t.key === tierKey);
  if (!tier) return { ok: false, reason: "invalid" };

  const balance = getCreditsState().balance;
  if (balance < tier.cost) return { ok: false, reason: "insufficient" };

  const credits = readCredits() ?? {
    balance: 0,
    transactions: [],
    assetUnlocks: [],
    companyUnlocks: {},
    ownerUnlocks: {},
    deepReportUnlocks: [],
  };
  credits.balance -= tier.cost;
  credits.transactions = [
    {
      id: genId(),
      type: "subscribe_demand",
      description: `Theo dõi nhu cầu ${tier.label}`,
      creditDelta: -tier.cost,
      at: Date.now(),
    },
    ...credits.transactions,
  ];
  writeCredits(credits);

  // Cộng dồn nếu đang còn hạn
  const current = read();
  const now = Date.now();
  const base = current && current.expiresAt > now ? current.expiresAt : now;
  const startedAt = current && current.expiresAt > now ? current.startedAt : now;
  write({
    tier: tierKey,
    startedAt,
    expiresAt: base + tier.days * 24 * 60 * 60 * 1000,
  });

  return { ok: true };
};

export const cancelDemandSubscription = () => write(null);

// re-export để tránh unused import warning
void CREDIT_PACKAGES;
