// Credit system backed by Supabase. DB-persisted, client-trusted.
import { supabase } from "@/integrations/supabase/client";
import { expandUnlock, formatPeriodLabel, parsePeriod } from "./reportPeriods";

// ─── Constants (stay as code, not in DB) ────────────────────────────────────

export const ASSET_COST = 59;

export const DEEP_REPORT_PERIOD_PRICES = {
  month: 990,
  quarter: 2490,
  year: 8900,
} as const;

export type DeepReportPeriodKind = keyof typeof DEEP_REPORT_PERIOD_PRICES;

export type CompanyTierKey = "7d" | "30d" | "1y";

export const COMPANY_TIERS: { key: CompanyTierKey; days: number; cost: number; label: string; valueText: string }[] = [
  { key: "7d",  days: 7,   cost: 99,   label: "7 ngày",  valueText: "Xem toàn bộ danh sách tài sản" },
  { key: "30d", days: 30,  cost: 299,  label: "30 ngày", valueText: "Hiểu nhanh toàn bộ nguồn tài sản — nhóm theo khu vực & giá" },
  { key: "1y",  days: 365, cost: 1990, label: "1 năm",   valueText: "Theo dõi nguồn đấu giá dài hạn, truy cập liên tục" },
];

export type OwnerTierKey = "7d" | "30d" | "1y";

export const OWNER_TIERS: { key: OwnerTierKey; days: number; cost: number; label: string; valueText: string }[] = [
  { key: "7d",  days: 7,   cost: 49,  label: "7 ngày",  valueText: "Xem toàn bộ danh sách tài sản của chủ" },
  { key: "30d", days: 30,  cost: 149, label: "30 ngày", valueText: "Theo dõi danh sách & lịch sử đấu giá của chủ tài sản" },
  { key: "1y",  days: 365, cost: 995, label: "1 năm",   valueText: "Theo dõi dài hạn, không bỏ lỡ tài sản mới" },
];

export type CreditPackageKey = "starter" | "popular" | "value" | "pro" | "max";

export const CREDIT_PACKAGES: { key: CreditPackageKey; name: string; priceVnd: number; baseCredits: number; credits: number; popular?: boolean; best?: boolean }[] = [
  { key: "starter", name: "Starter", priceVnd: 69_000,    baseCredits: 69,   credits: 69 },
  { key: "popular", name: "Popular", priceVnd: 179_000,   baseCredits: 179,  credits: 190, popular: true },
  { key: "value",   name: "Value",   priceVnd: 299_000,   baseCredits: 299,  credits: 330 },
  { key: "pro",     name: "Pro",     priceVnd: 499_000,   baseCredits: 499,  credits: 600 },
  { key: "max",     name: "Max",     priceVnd: 1_999_000, baseCredits: 1999, credits: 2600, best: true },
];

// ─── Types ───────────────────────────────────────────────────────────────────

export type TransactionType =
  | "purchase"
  | "unlock_asset"
  | "unlock_company"
  | "unlock_owner"
  | "unlock_deep_report";

export interface Transaction {
  id: string;
  type: TransactionType;
  description: string;
  creditDelta: number;
  at: number;
}

export interface CompanyAccess {
  isUnlocked: boolean;
  tier: CompanyTierKey | null;
  expiresAt: number | null;
}

export interface OwnerAccess {
  isUnlocked: boolean;
  tier: OwnerTierKey | null;
  expiresAt: number | null;
}

export interface InvoiceInfo {
  companyName: string;
  taxCode: string;
  address: string;
  email: string;
}

export interface CreditState {
  balance: number;
  transactions: Transaction[];
  assetUnlocks: string[];
  companyUnlocks: { orgId: string; tier: CompanyTierKey; expiresAt: number }[];
  ownerUnlocks: { ownerId: string; tier: OwnerTierKey; expiresAt: number }[];
  reportUnlocks: string[];
}

// ─── Read all credit state for a user ────────────────────────────────────────

export const fetchCreditState = async (userId: string): Promise<CreditState> => {
  const [creditsRes, txRes, assetRes, companyRes, ownerRes, reportRes] = await Promise.all([
    supabase.from("user_credits").select("balance").eq("user_id", userId).maybeSingle(),
    supabase.from("credit_transactions").select("id, type, description, credit_delta, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    supabase.from("user_asset_unlocks").select("listing_id").eq("user_id", userId),
    supabase.from("user_company_unlocks").select("org_id, tier, expires_at").eq("user_id", userId),
    supabase.from("user_owner_unlocks").select("owner_id, tier, expires_at").eq("user_id", userId),
    supabase.from("user_report_unlocks").select("unlock_key").eq("user_id", userId),
  ]);

  return {
    balance: creditsRes.data?.balance ?? 0,
    transactions: (txRes.data ?? []).map((r) => ({
      id: r.id,
      type: r.type as TransactionType,
      description: r.description,
      creditDelta: r.credit_delta,
      at: new Date(r.created_at).getTime(),
    })),
    assetUnlocks: (assetRes.data ?? []).map((r) => r.listing_id),
    companyUnlocks: (companyRes.data ?? []).map((r) => ({
      orgId: r.org_id,
      tier: r.tier as CompanyTierKey,
      expiresAt: new Date(r.expires_at).getTime(),
    })),
    ownerUnlocks: (ownerRes.data ?? []).map((r) => ({
      ownerId: r.owner_id,
      tier: r.tier as OwnerTierKey,
      expiresAt: new Date(r.expires_at).getTime(),
    })),
    reportUnlocks: (reportRes.data ?? []).map((r) => r.unlock_key),
  };
};

// ─── Helpers to derive access from state ─────────────────────────────────────

export const deriveCompanyAccess = (state: CreditState | undefined, orgId: string): CompanyAccess => {
  if (!state) return { isUnlocked: false, tier: null, expiresAt: null };
  const now = Date.now();
  const unlock = state.companyUnlocks
    .filter((u) => u.orgId === orgId && u.expiresAt > now)
    .sort((a, b) => b.expiresAt - a.expiresAt)[0];
  if (!unlock) return { isUnlocked: false, tier: null, expiresAt: null };
  return { isUnlocked: true, tier: unlock.tier, expiresAt: unlock.expiresAt };
};

export const deriveOwnerAccess = (state: CreditState | undefined, ownerId: string): OwnerAccess => {
  if (!state) return { isUnlocked: false, tier: null, expiresAt: null };
  const now = Date.now();
  const unlock = state.ownerUnlocks
    .filter((u) => u.ownerId === ownerId && u.expiresAt > now)
    .sort((a, b) => b.expiresAt - a.expiresAt)[0];
  if (!unlock) return { isUnlocked: false, tier: null, expiresAt: null };
  return { isUnlocked: true, tier: unlock.tier, expiresAt: unlock.expiresAt };
};

// ─── Mutations (async, direct Supabase calls) ─────────────────────────────────

const ensureCreditsRow = async (userId: string) => {
  await supabase
    .from("user_credits")
    .upsert({ user_id: userId, balance: 0 }, { onConflict: "user_id", ignoreDuplicates: true });
};

export const addCredits = async (
  userId: string,
  credits: number,
  packageKey?: CreditPackageKey,
): Promise<void> => {
  await ensureCreditsRow(userId);
  const pkg = packageKey ? CREDIT_PACKAGES.find((p) => p.key === packageKey) : null;
  const { data } = await supabase.from("user_credits").select("balance").eq("user_id", userId).single();
  const current = data?.balance ?? 0;
  await Promise.all([
    supabase.from("user_credits").update({ balance: current + credits, updated_at: new Date().toISOString() }).eq("user_id", userId),
    supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "purchase",
      description: pkg ? `Mua gói ${pkg.name}` : `Nạp ${credits} tín dụng`,
      credit_delta: credits,
    }),
  ]);
};

const deductCredits = async (userId: string, amount: number): Promise<boolean> => {
  const { data } = await supabase.from("user_credits").select("balance").eq("user_id", userId).single();
  const balance = data?.balance ?? 0;
  if (balance < amount) return false;
  const { error } = await supabase
    .from("user_credits")
    .update({ balance: balance - amount, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  return !error;
};

export const unlockAsset = async (
  userId: string,
  listingId: string,
  label?: string,
): Promise<{ ok: boolean; reason?: "insufficient" | "already" }> => {
  await ensureCreditsRow(userId);

  const { data: existing } = await supabase
    .from("user_asset_unlocks")
    .select("id")
    .eq("user_id", userId)
    .eq("listing_id", listingId)
    .maybeSingle();
  if (existing) return { ok: true, reason: "already" };

  const ok = await deductCredits(userId, ASSET_COST);
  if (!ok) return { ok: false, reason: "insufficient" };

  await Promise.all([
    supabase.from("user_asset_unlocks").insert({ user_id: userId, listing_id: listingId }),
    supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "unlock_asset",
      description: `Mở khóa tài sản ${label ?? listingId}`,
      credit_delta: -ASSET_COST,
    }),
  ]);
  return { ok: true };
};

export const unlockCompany = async (
  userId: string,
  orgId: string,
  tierKey: CompanyTierKey,
  label?: string,
): Promise<{ ok: boolean; reason?: "insufficient" }> => {
  await ensureCreditsRow(userId);
  const tier = COMPANY_TIERS.find((t) => t.key === tierKey)!;

  // Extend from existing expiry if still active
  const { data: existing } = await supabase
    .from("user_company_unlocks")
    .select("expires_at")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ok = await deductCredits(userId, tier.cost);
  if (!ok) return { ok: false, reason: "insufficient" };

  const base = existing ? new Date(existing.expires_at).getTime() : Date.now();
  const expiresAt = new Date(base + tier.days * 24 * 60 * 60 * 1000).toISOString();

  await Promise.all([
    supabase.from("user_company_unlocks").insert({ user_id: userId, org_id: orgId, tier: tierKey, expires_at: expiresAt }),
    supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "unlock_company",
      description: `Theo dõi công ty ${label ?? orgId} ${tier.label}`,
      credit_delta: -tier.cost,
    }),
  ]);
  return { ok: true };
};

export const unlockOwner = async (
  userId: string,
  ownerId: string,
  tierKey: OwnerTierKey,
  label?: string,
): Promise<{ ok: boolean; reason?: "insufficient" }> => {
  await ensureCreditsRow(userId);
  const tier = OWNER_TIERS.find((t) => t.key === tierKey)!;

  const { data: existing } = await supabase
    .from("user_owner_unlocks")
    .select("expires_at")
    .eq("user_id", userId)
    .eq("owner_id", ownerId)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ok = await deductCredits(userId, tier.cost);
  if (!ok) return { ok: false, reason: "insufficient" };

  const base = existing ? new Date(existing.expires_at).getTime() : Date.now();
  const expiresAt = new Date(base + tier.days * 24 * 60 * 60 * 1000).toISOString();

  await Promise.all([
    supabase.from("user_owner_unlocks").insert({ user_id: userId, owner_id: ownerId, tier: tierKey, expires_at: expiresAt }),
    supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "unlock_owner",
      description: `Theo dõi chủ tài sản ${label ?? ownerId} ${tier.label}`,
      credit_delta: -tier.cost,
    }),
  ]);
  return { ok: true };
};

export const unlockDeepReportPeriod = async (
  userId: string,
  slug: string,
  periodId: string,
  reportLabel?: string,
): Promise<{ ok: boolean; reason?: "insufficient" | "already" | "invalid" }> => {
  await ensureCreditsRow(userId);
  const parsed = parsePeriod(periodId);
  if (!parsed) return { ok: false, reason: "invalid" };

  const deepKey = (s: string, p: string) => `${s}:${p}`;

  const { data: existing } = await supabase
    .from("user_report_unlocks")
    .select("id")
    .eq("user_id", userId)
    .eq("unlock_key", deepKey(slug, periodId))
    .maybeSingle();
  if (existing) return { ok: true, reason: "already" };

  const cost = DEEP_REPORT_PERIOD_PRICES[parsed.kind];
  const ok = await deductCredits(userId, cost);
  if (!ok) return { ok: false, reason: "insufficient" };

  const expanded = expandUnlock(periodId).map((p) => deepKey(slug, p));
  await Promise.all([
    supabase.from("user_report_unlocks").upsert(
      expanded.map((key) => ({ user_id: userId, unlock_key: key })),
      { onConflict: "user_id,unlock_key", ignoreDuplicates: true }
    ),
    supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "unlock_deep_report",
      description: `Mở khóa ${reportLabel ?? slug} — ${formatPeriodLabel(periodId)}`,
      credit_delta: -cost,
    }),
  ]);
  return { ok: true };
};

// ─── Invoice info ─────────────────────────────────────────────────────────────

export const getInvoiceInfo = async (userId: string): Promise<InvoiceInfo | null> => {
  const { data } = await supabase
    .from("profiles")
    .select("invoice_info")
    .eq("id", userId)
    .single();
  return (data?.invoice_info as InvoiceInfo | null) ?? null;
};

export const saveInvoiceInfo = async (userId: string, info: InvoiceInfo): Promise<void> => {
  await supabase
    .from("profiles")
    .update({ invoice_info: info as any })
    .eq("id", userId);
};
