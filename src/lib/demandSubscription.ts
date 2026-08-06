// Gói theo dõi nhu cầu.
//
// TRƯỚC: credit bị trừ THẬT qua Supabase nhưng trạng thái gói lại lưu ở
// localStorage — nên đổi trình duyệt hoặc xoá cache là mất gói ĐÃ TRẢ TIỀN, và
// không có cách nào đối chiếu vì ledger chỉ ghi "đã trừ", không ghi "còn hiệu
// lực đến bao giờ".
//
// NAY: trạng thái nằm ở bảng user_demand_subscriptions (RLS "own rows" — đây là
// dữ liệu cá nhân, không phải của tổ chức).
import { CREDIT_PACKAGES } from "./credits";


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

import { supabase } from "@/integrations/supabase/client";
import { fetchCreditState } from "./credits";

export type DemandStatus = "NOT_SUBSCRIBED" | "ACTIVE" | "EXPIRED";

export interface DemandSubscriptionState {
  status: DemandStatus;
  tier: DemandTierKey | null;
  /** epoch ms — giữ nguyên kiểu số của bản cũ để UI không phải đổi. */
  startedAt: number | null;
  expiresAt: number | null;
  daysRemaining: number;
}

export const NOT_SUBSCRIBED: DemandSubscriptionState = {
  status: "NOT_SUBSCRIBED",
  tier: null,
  startedAt: null,
  expiresAt: null,
  daysRemaining: 0,
};

const DAY_MS = 24 * 60 * 60 * 1000;

interface Row {
  tier: string;
  started_at: string;
  expires_at: string;
}

/** Suy trạng thái hiển thị từ một dòng DB. Thuần — test được. */
export const stateFromRow = (
  row: Row | null,
  now: number = Date.now(),
): DemandSubscriptionState => {
  if (!row) return NOT_SUBSCRIBED;
  const startedAt = new Date(row.started_at).getTime();
  const expiresAt = new Date(row.expires_at).getTime();
  const tier = row.tier as DemandTierKey;
  if (expiresAt < now) {
    return { status: "EXPIRED", tier, startedAt, expiresAt, daysRemaining: 0 };
  }
  return {
    status: "ACTIVE",
    tier,
    startedAt,
    expiresAt,
    // Math.max(1, …) để gói còn vài giờ vẫn hiện "1 ngày" thay vì "0 ngày".
    daysRemaining: Math.max(1, Math.ceil((expiresAt - now) / DAY_MS)),
  };
};

export const fetchDemandSubscription = async (
  userId: string,
): Promise<DemandSubscriptionState> => {
  const { data, error } = await supabase
    .from("user_demand_subscriptions")
    .select("tier, started_at, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return stateFromRow((data as Row | null) ?? null);
};

export const subscribeDemand = async (
  userId: string,
  tierKey: DemandTierKey,
): Promise<{ ok: boolean; reason?: "insufficient" | "invalid" }> => {
  const tier = DEMAND_TIERS.find((t) => t.key === tierKey);
  if (!tier) return { ok: false, reason: "invalid" };
  if (!userId) return { ok: false, reason: "insufficient" };

  const state = await fetchCreditState(userId);
  if (state.balance < tier.cost) return { ok: false, reason: "insufficient" };

  // Ghi GÓI TRƯỚC, trừ credit SAU. Ngược lại thì nếu bước ghi gói lỗi, user đã
  // mất credit mà không có gói — đúng lỗi mà đợt này đi sửa. Ghi gói trước, nếu
  // trừ credit lỗi thì user được gói "miễn phí": thiệt cho mình nhưng không mất
  // tiền của khách, và ledger vẫn khớp vì chưa ghi gì.
  const current = await supabase
    .from("user_demand_subscriptions")
    .select("started_at, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  const now = Date.now();
  const prevExpires = current.data ? new Date(current.data.expires_at).getTime() : 0;
  // Gia hạn thì CỘNG DỒN từ hạn cũ, không reset — cùng quy ước stacking của
  // unlockCompany/unlockOwner.
  const base = prevExpires > now ? prevExpires : now;
  const startedAt =
    current.data && prevExpires > now ? current.data.started_at : new Date(now).toISOString();

  const { error: subErr } = await supabase.from("user_demand_subscriptions").upsert(
    {
      user_id: userId,
      tier: tierKey,
      started_at: startedAt,
      expires_at: new Date(base + tier.days * DAY_MS).toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (subErr) throw subErr;

  const { data: bal } = await supabase
    .from("user_credits")
    .select("balance")
    .eq("user_id", userId)
    .single();
  const balance = bal?.balance ?? 0;
  await Promise.all([
    supabase
      .from("user_credits")
      .update({ balance: balance - tier.cost, updated_at: new Date().toISOString() })
      .eq("user_id", userId),
    // Ledger append-only: mỗi lần trừ là một dòng mới.
    supabase.from("credit_transactions").insert({
      user_id: userId,
      type: "subscribe_demand",
      description: `Theo dõi nhu cầu ${tier.label}`,
      credit_delta: -tier.cost,
    }),
  ]);

  return { ok: true };
};

export const cancelDemandSubscription = async (userId: string): Promise<void> => {
  const { error } = await supabase.from("user_demand_subscriptions").delete().eq("user_id", userId);
  if (error) throw error;
};
