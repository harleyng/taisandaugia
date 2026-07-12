// Cache catalog dịch vụ ở tầng module — cho các hàm ASYNC không phải hook
// (credits.ts unlock/addCredits) đọc giá từ DB. Giá là NGUỒN SỰ THẬT ở DB
// (service_variants, public-read), nhưng luôn có FALLBACK về hằng số code để
// không bao giờ chặn luồng trừ credit nếu fetch lỗi.

import { supabase } from "@/integrations/supabase/client";

export interface CatalogVariant {
  id: string;
  variant_key: string;
  name: string;
  price: number;
  base_credits: number | null;
  credits: number | null;
  credit_cost: number | null;
  service_id: string;
  audience: string;
  category: string | null;
}

// Fallback credit_cost theo variant_key (chỉ dùng khi DB không đọc được). Cố ý
// KHÔNG import từ credits.ts để tránh vòng lặp (credits.ts import file này). Giá
// trị khớp seed catalog trong migration 20260715000001.
const FALLBACK_COST: Record<string, number> = {
  asset_unlock: 59,
  track_company_7d: 99,
  track_company_30d: 299,
  track_company_1y: 1990,
  track_owner_7d: 49,
  track_owner_30d: 149,
  track_owner_1y: 995,
  deep_report_month: 990,
  deep_report_quarter: 2490,
  deep_report_year: 8900,
  report_portfolio_owner: 4,
  report_opp_buyer: 1,
  export_profile_company: 30,
};

let cache: Promise<Map<string, CatalogVariant>> | null = null;

async function fetchCatalog(): Promise<Map<string, CatalogVariant>> {
  const { data, error } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("service_variants")
    .select(
      "id, variant_key, name, price, base_credits, credits, credit_cost, service_id, group:services!inner(audience, category)",
    )
    .eq("is_active", true);
  if (error) throw error;
  const map = new Map<string, CatalogVariant>();
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    const group = r.group as { audience?: string; category?: string } | null;
    map.set(r.variant_key as string, {
      id: r.id as string,
      variant_key: r.variant_key as string,
      name: r.name as string,
      price: Number(r.price ?? 0),
      base_credits: r.base_credits as number | null,
      credits: r.credits as number | null,
      credit_cost: r.credit_cost as number | null,
      service_id: r.service_id as string,
      audience: group?.audience ?? "all",
      category: group?.category ?? null,
    });
  }
  return map;
}

/** Lấy catalog (single in-flight promise; reset khi admin sửa). */
export function getCatalog(): Promise<Map<string, CatalogVariant>> {
  if (!cache) {
    cache = fetchCatalog().catch((e) => {
      cache = null; // cho phép thử lại lần sau
      throw e;
    });
  }
  return cache;
}

export function resetCatalogCache(): void {
  cache = null;
}

/** credit_cost của một biến thể (fallback hằng số nếu DB lỗi/thiếu). */
export async function getVariantCost(variantKey: string): Promise<number> {
  try {
    const v = (await getCatalog()).get(variantKey);
    if (v?.credit_cost != null) return v.credit_cost;
  } catch {
    /* fall through to fallback */
  }
  return FALLBACK_COST[variantKey] ?? 0;
}

/** Thông tin gói nạp (credits nhận về + tên) để ghi ledger. */
export async function getVariantPackage(
  variantKey: string,
): Promise<{ id: string; name: string; credits: number } | null> {
  try {
    const v = (await getCatalog()).get(variantKey);
    if (v) return { id: v.id, name: v.name, credits: v.credits ?? 0 };
  } catch {
    /* ignore */
  }
  return null;
}
