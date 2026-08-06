// Credit system backed by Supabase. DB-persisted, client-trusted.
// Giá là NGUỒN SỰ THẬT ở DB (service_variants) qua serviceCatalog.getVariantCost;
// hằng số dưới đây chỉ còn là fallback khi DB không đọc được.
import { supabase } from "@/integrations/supabase/client";
import { expandUnlock, formatPeriodLabel, parsePeriod } from "./reportPeriods";
import { getVariantCost, getVariantPackage } from "./serviceCatalog";
import type { Json } from "@/integrations/supabase/types";

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
  | "unlock_deep_report"
  | "owner_report_view"
  | "unlock_opp_report"
  | "export_profile"
  | "export_personnel_dossier";

export const OWNER_REPORT_COST = 4;

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

/**
 * Nhận "vé" xử lý một giao dịch thanh toán. TRUE = lần đầu, hãy cộng credit /
 * mở khoá. FALSE = đã xử lý rồi, BỎ QUA hết.
 *
 * Khoá nằm ở SERVER (RPC claim_payment_txn, migration 20260806000070) vì đây là
 * tiền: guard phía client không sống qua được F5 hay back/forward.
 */
export const claimPaymentTxn = async (
  txnRef: string,
  variantKey?: string | null,
  unlockParam?: string | null,
): Promise<boolean> => {
  const { data, error } = await supabase.rpc("claim_payment_txn", {
    _txn_ref: txnRef,
    _variant_key: variantKey ?? null,
    _unlock_param: unlockParam ?? null,
  });
  if (error) {
    // Không xác định được ⇒ CHO PHÉP đi tiếp. Thà chịu rủi ro cộng đôi (đối
    // soát được qua ledger) hơn là chặn một giao dịch thật và khách mất tiền
    // trắng.
    console.error("[claimPaymentTxn]", error);
    return true;
  }
  return data === true;
};

export const addCredits = async (
  userId: string,
  credits: number,
  variantKey?: string,
): Promise<void> => {
  await ensureCreditsRow(userId);
  // Giá/tên gói lấy từ catalog DB (service_variants) qua variant_key; giữ quy ước
  // description "Mua gói {name}" + lưu variant_key/service_variant_id để quy doanh thu.
  const variant = variantKey ? await getVariantPackage(variantKey) : null;
  const { data } = await supabase.from("user_credits").select("balance").eq("user_id", userId).single();
  const current = data?.balance ?? 0;
  await Promise.all([
    supabase.from("user_credits").update({ balance: current + credits, updated_at: new Date().toISOString() }).eq("user_id", userId),
    supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "purchase",
      description: variant ? `Mua gói ${variant.name}` : `Nạp ${credits} tín dụng`,
      credit_delta: credits,
      variant_key: variantKey ?? null,
      service_variant_id: variant?.id ?? null,
    }),
    // "Nạp lần đầu để kích hoạt": the first top-up activates the account.
    // The activated=false filter makes this a no-op on subsequent top-ups
    // (so activated_at keeps the original activation time).
    supabase
      .from("profiles")
      .update({ activated: true, activated_at: new Date().toISOString() })
      .eq("id", userId)
      .eq("activated", false),
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

  const cost = await getVariantCost("asset_unlock");
  const ok = await deductCredits(userId, cost);
  if (!ok) return { ok: false, reason: "insufficient" };

  await Promise.all([
    supabase.from("user_asset_unlocks").insert({ user_id: userId, listing_id: listingId }),
    supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "unlock_asset",
      description: `Mở khóa tài sản ${label ?? listingId}`,
      credit_delta: -cost,
      variant_key: "asset_unlock",
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
  const variantKey = `track_company_${tierKey}`;
  const cost = await getVariantCost(variantKey);

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

  const ok = await deductCredits(userId, cost);
  if (!ok) return { ok: false, reason: "insufficient" };

  const base = existing ? new Date(existing.expires_at).getTime() : Date.now();
  const expiresAt = new Date(base + tier.days * 24 * 60 * 60 * 1000).toISOString();

  await Promise.all([
    supabase.from("user_company_unlocks").insert({ user_id: userId, org_id: orgId, tier: tierKey, expires_at: expiresAt }),
    supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "unlock_company",
      description: `Theo dõi công ty ${label ?? orgId} ${tier.label}`,
      credit_delta: -cost,
      variant_key: variantKey,
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
  const variantKey = `track_owner_${tierKey}`;
  const cost = await getVariantCost(variantKey);

  const { data: existing } = await supabase
    .from("user_owner_unlocks")
    .select("expires_at")
    .eq("user_id", userId)
    .eq("owner_id", ownerId)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ok = await deductCredits(userId, cost);
  if (!ok) return { ok: false, reason: "insufficient" };

  const base = existing ? new Date(existing.expires_at).getTime() : Date.now();
  const expiresAt = new Date(base + tier.days * 24 * 60 * 60 * 1000).toISOString();

  await Promise.all([
    supabase.from("user_owner_unlocks").insert({ user_id: userId, owner_id: ownerId, tier: tierKey, expires_at: expiresAt }),
    supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "unlock_owner",
      description: `Theo dõi chủ tài sản ${label ?? ownerId} ${tier.label}`,
      credit_delta: -cost,
      variant_key: variantKey,
    }),
  ]);
  return { ok: true };
};

export const chargeOwnerReport = async (
  userId: string,
  workspaceId: string,
  // Ghi thẳng vào cột JSONB owner_report_views.filter_combo — dùng Json thay
  // `object` để khớp kiểu sinh tự động.
  filterCombo: Json,
  isDefault: boolean,
): Promise<{ ok: boolean; reason?: "insufficient" }> => {
  const cost = isDefault ? 0 : await getVariantCost("report_portfolio_owner");
  if (cost > 0) {
    await ensureCreditsRow(userId);
    const ok = await deductCredits(userId, cost);
    if (!ok) return { ok: false, reason: "insufficient" };
    await supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "owner_report_view",
      description: "Báo cáo danh mục tài sản",
      credit_delta: -cost,
      variant_key: "report_portfolio_owner",
    });
  }
  await supabase.from("owner_report_views").insert({
    workspace_id: workspaceId,
    user_id: userId,
    filter_combo: filterCombo,
    is_default: isDefault,
    credits_charged: cost,
  });
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

  const cost = await getVariantCost(`deep_report_${parsed.kind}`);
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
      variant_key: `deep_report_${parsed.kind}`,
    }),
  ]);
  return { ok: true };
};

// Báo cáo cơ hội (người mua) — trừ 1 credit/lượt (giá từ catalog).
export const chargeOppReport = async (
  userId: string,
): Promise<{ ok: boolean; reason?: "insufficient" }> => {
  await ensureCreditsRow(userId);
  const cost = await getVariantCost("report_opp_buyer");
  const ok = await deductCredits(userId, cost);
  if (!ok) return { ok: false, reason: "insufficient" };
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    type: "unlock_opp_report",
    description: "Xem báo cáo cơ hội đấu giá",
    credit_delta: -cost,
    variant_key: "report_opp_buyer",
  });
  return { ok: true };
};

// Xuất hồ sơ dự tuyển (công ty) — trừ theo giá catalog (thay anti-pattern addCredits âm).
export const chargeExportProfile = async (
  userId: string,
): Promise<{ ok: boolean; reason?: "insufficient" }> => {
  await ensureCreditsRow(userId);
  const cost = await getVariantCost("export_profile_company");
  const ok = await deductCredits(userId, cost);
  if (!ok) return { ok: false, reason: "insufficient" };
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    type: "export_profile",
    description: "Xuất hồ sơ dự tuyển đấu giá",
    credit_delta: -cost,
    variant_key: "export_profile_company",
  });
  return { ok: true };
};

// Xuất hồ sơ đấu giá viên — 1 credit/hồ sơ/lần, giá lấy từ catalog.
//
// MỘT lần trừ N x đơn giá và MỘT dòng sổ cái, không phải N lần: credit_transactions
// không có FK theo thực thể nên N dòng giống hệt nhau chỉ gây rối, và deductCredits
// là read-then-write KHÔNG atomic — gọi tuần tự N lần nhân N cửa sổ tranh chấp và
// có thể hỏng nửa chừng, để lại người dùng bị trừ một phần mà không rollback được.
export const chargePersonnelDossierExport = async (
  userId: string,
  count: number,
): Promise<{ ok: boolean; reason?: "insufficient"; unitCost?: number }> => {
  await ensureCreditsRow(userId);
  const unit = await getVariantCost("export_personnel_dossier");
  const total = unit * Math.max(1, count);
  const ok = await deductCredits(userId, total);
  if (!ok) return { ok: false, reason: "insufficient", unitCost: unit };
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    type: "export_personnel_dossier",
    description: `Xuất hồ sơ đấu giá viên (${count} hồ sơ)`,
    credit_delta: -total,
    variant_key: "export_personnel_dossier",
  });
  return { ok: true, unitCost: unit };
};

// ─── Invoice info ─────────────────────────────────────────────────────────────

export const getInvoiceInfo = async (userId: string): Promise<InvoiceInfo | null> => {
  const { data } = await supabase
    .from("profiles")
    .select("invoice_info")
    .eq("id", userId)
    .single();
  return (data?.invoice_info as unknown as InvoiceInfo | null) ?? null;
};

export const saveInvoiceInfo = async (userId: string, info: InvoiceInfo): Promise<void> => {
  await supabase
    .from("profiles")
    .update({ invoice_info: info as unknown as Json })
    .eq("id", userId);
};
