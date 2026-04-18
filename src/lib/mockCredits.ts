// Mock credit system. Persisted in localStorage. Swap to real backend later.
const KEY = "mockCredits.v1";
const EVT = "mockCredits:change";
const INVOICE_KEY = "mockCredits.invoiceInfo.v1";

export interface InvoiceInfo {
  companyName: string;
  taxCode: string;
  address: string;
  email: string;
}

export const getInvoiceInfo = (): InvoiceInfo | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(INVOICE_KEY);
    return raw ? (JSON.parse(raw) as InvoiceInfo) : null;
  } catch {
    return null;
  }
};

export const saveInvoiceInfo = (info: InvoiceInfo) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(INVOICE_KEY, JSON.stringify(info));
};

export const ASSET_COST = 59;

export type CompanyTierKey = "7d" | "30d" | "1y";

export const COMPANY_TIERS: { key: CompanyTierKey; days: number; cost: number; label: string; valueText: string }[] = [
  { key: "7d", days: 7, cost: 99, label: "7 ngày", valueText: "Xem toàn bộ danh sách tài sản" },
  { key: "30d", days: 30, cost: 299, label: "30 ngày", valueText: "Hiểu nhanh toàn bộ nguồn tài sản — nhóm theo khu vực & giá" },
  { key: "1y", days: 365, cost: 1990, label: "1 năm", valueText: "Theo dõi nguồn đấu giá dài hạn, truy cập liên tục" },
];

export type CreditPackageKey = "starter" | "popular" | "value" | "pro" | "max";

export const CREDIT_PACKAGES: { key: CreditPackageKey; name: string; priceVnd: number; baseCredits: number; credits: number; popular?: boolean; best?: boolean }[] = [
  { key: "starter", name: "Starter", priceVnd: 69_000, baseCredits: 69, credits: 69 },
  { key: "popular", name: "Popular", priceVnd: 179_000, baseCredits: 179, credits: 190, popular: true },
  { key: "value", name: "Value", priceVnd: 299_000, baseCredits: 299, credits: 330 },
  { key: "pro", name: "Pro", priceVnd: 499_000, baseCredits: 499, credits: 600 },
  { key: "max", name: "Max", priceVnd: 1_999_000, baseCredits: 1999, credits: 2600, best: true },
];

interface CompanyUnlock {
  tier: CompanyTierKey;
  expiresAt: number; // epoch ms
}

export type TransactionType = "purchase" | "unlock_asset" | "unlock_company";

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  creditDelta: number;
  at: number;
}

interface MockState {
  balance: number;
  assetUnlocks: string[];
  companyUnlocks: Record<string, CompanyUnlock>;
  transactions: Transaction[];
}

const defaultState: MockState = {
  balance: 0,
  assetUnlocks: [],
  companyUnlocks: {},
  transactions: [],
};

let cached: MockState | null = null;

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const read = (): MockState => {
  if (typeof window === "undefined") return defaultState;
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      cached = defaultState;
    } else {
      const parsed = JSON.parse(raw);
      // Migrate legacy `purchases` → `transactions`
      if (!parsed.transactions && Array.isArray(parsed.purchases)) {
        parsed.transactions = parsed.purchases.map((p: { packageKey: CreditPackageKey; credits: number; at: number }) => {
          const pkg = CREDIT_PACKAGES.find((x) => x.key === p.packageKey);
          return {
            id: genId(),
            type: "purchase" as TransactionType,
            description: `Mua gói ${pkg?.name ?? p.packageKey}`,
            creditDelta: p.credits,
            at: p.at,
          };
        });
        delete parsed.purchases;
      }
      cached = { ...defaultState, ...parsed };
    }
  } catch {
    cached = defaultState;
  }
  return cached;
};

const write = (s: MockState) => {
  cached = s;
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent(EVT));
};

const pushTx = (s: MockState, tx: Omit<Transaction, "id" | "at"> & { at?: number }) => {
  s.transactions.unshift({
    id: genId(),
    at: tx.at ?? Date.now(),
    type: tx.type,
    description: tx.description,
    creditDelta: tx.creditDelta,
  });
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) cached = null;
  });
}

export const subscribe = (cb: () => void) => {
  const handler = () => cb();
  window.addEventListener(EVT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener("storage", handler);
  };
};

export const getState = (): MockState => read();

export const addCredits = (credits: number, packageKey?: CreditPackageKey, _priceVnd?: number) => {
  const s = read();
  s.balance += credits;
  if (packageKey) {
    const pkg = CREDIT_PACKAGES.find((p) => p.key === packageKey);
    pushTx(s, {
      type: "purchase",
      description: `Mua gói ${pkg?.name ?? packageKey}`,
      creditDelta: credits,
    });
  }
  write(s);
};

export const isAssetUnlocked = (id: string) => read().assetUnlocks.includes(id);

export const unlockAsset = (id: string, label?: string): { ok: boolean; reason?: "insufficient" | "already" } => {
  const s = read();
  if (s.assetUnlocks.includes(id)) return { ok: true, reason: "already" };
  if (s.balance < ASSET_COST) return { ok: false, reason: "insufficient" };
  s.balance -= ASSET_COST;
  s.assetUnlocks.push(id);
  pushTx(s, {
    type: "unlock_asset",
    description: `Mở khóa tài sản ${label ?? id}`,
    creditDelta: -ASSET_COST,
  });
  write(s);
  return { ok: true };
};

export interface CompanyAccess {
  isUnlocked: boolean;
  tier: CompanyTierKey | null;
  expiresAt: number | null;
}

export const getCompanyAccess = (orgId: string): CompanyAccess => {
  const s = read();
  const u = s.companyUnlocks[orgId];
  if (!u) return { isUnlocked: false, tier: null, expiresAt: null };
  if (u.expiresAt < Date.now()) return { isUnlocked: false, tier: null, expiresAt: u.expiresAt };
  return { isUnlocked: true, tier: u.tier, expiresAt: u.expiresAt };
};

export const unlockCompany = (orgId: string, tierKey: CompanyTierKey, label?: string): { ok: boolean; reason?: "insufficient" } => {
  const tier = COMPANY_TIERS.find((t) => t.key === tierKey)!;
  const s = read();
  if (s.balance < tier.cost) return { ok: false, reason: "insufficient" };
  s.balance -= tier.cost;
  const existing = s.companyUnlocks[orgId];
  const base = existing && existing.expiresAt > Date.now() ? existing.expiresAt : Date.now();
  s.companyUnlocks[orgId] = {
    tier: tierKey,
    expiresAt: base + tier.days * 24 * 60 * 60 * 1000,
  };
  pushTx(s, {
    type: "unlock_company",
    description: `Theo dõi công ty ${label ?? orgId} ${tier.label}`,
    creditDelta: -tier.cost,
  });
  write(s);
  return { ok: true };
};
