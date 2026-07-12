// Tổng hợp báo cáo giao dịch từ ledger `credit_transactions`.
//
// Bối cảnh dữ liệu quan trọng:
//  - KHÔNG có bảng payments/orders — VND doanh thu không lưu trong DB. Ta suy ra
//    doanh thu từ các dòng nạp (`type='purchase' AND credit_delta > 0`) rồi map
//    ngược ra giá VND theo tên gói trong CREDIT_PACKAGES (nguồn giá duy nhất).
//  - `type='purchase'` cũng bị ghi cho vài sự kiện khác: dòng ÂM là "Xuất hồ sơ"
//    (spend ghi nhầm), dòng DƯƠNG không khớp gói là top-up thưởng/debug ("Nạp khác").
//  Vì vậy predicate doanh thu phải lọc theo dấu + khớp tên gói, không chỉ theo `type`.
//
// Module thuần: không import React / Supabase.

import {
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  startOfWeek,
  format,
} from "date-fns";
import { CREDIT_PACKAGES, type CreditPackageKey } from "@/lib/credits";

export type Granularity = "day" | "week" | "month";

/** Một dòng ledger kèm embed profiles(name,email) từ PostgREST. */
export interface RawTxRow {
  id: string;
  user_id: string;
  type: string;
  description: string;
  credit_delta: number;
  created_at: string;
  profiles: { name: string | null; email: string } | null;
}

// ─── Predicates ──────────────────────────────────────────────────────────────

/** Dòng doanh thu: nạp tiền (credit dương, type purchase). */
export const isPurchase = (r: RawTxRow) => r.type === "purchase" && r.credit_delta > 0;

/** Dòng tiêu dùng: mọi credit âm (unlock_*, owner_report_view, subscribe_demand,
 *  và cả row `purchase` âm bị ghi nhầm = xuất hồ sơ). */
export const isConsumption = (r: RawTxRow) => r.credit_delta < 0;

// ─── Suy ra VND từ dòng nạp ──────────────────────────────────────────────────

export interface ResolvedPurchase {
  vnd: number;
  packageKey: CreditPackageKey | null;
  label: string;
}

/** Map một dòng nạp → giá VND theo tên gói trong description ("Mua gói {name}").
 *  KHÔNG fallback theo credit_delta để tránh đụng các top-up thưởng/debug cùng
 *  mệnh giá. Không khớp gói → "Nạp khác", vnd = 0. */
export function resolvePurchase(r: RawTxRow): ResolvedPurchase {
  const pkg = CREDIT_PACKAGES.find((p) => r.description.includes(`Mua gói ${p.name}`));
  if (pkg) return { vnd: pkg.priceVnd, packageKey: pkg.key, label: pkg.name };
  return { vnd: 0, packageKey: null, label: "Nạp khác" };
}

// ─── Catalog nhãn tính năng (nguồn duy nhất) ─────────────────────────────────

export const FEATURE_LABELS: Record<string, string> = {
  unlock_asset: "Mở khóa tài sản",
  unlock_company: "Theo dõi công ty",
  unlock_owner: "Theo dõi chủ tài sản",
  unlock_deep_report: "Mở khóa báo cáo chuyên sâu",
  owner_report_view: "Xem báo cáo chủ tài sản",
  subscribe_demand: "Đăng ký nhu cầu",
  // row `purchase` âm = xuất hồ sơ (ghi nhầm type)
  purchase: "Xuất hồ sơ",
};

export const featureLabel = (type: string) => FEATURE_LABELS[type] ?? type;

// Nhãn cho các dòng CỘNG credit KHÔNG phải mua gói (grant admin, thưởng, top-up debug).
export const TOPUP_LABELS: Record<string, string> = {
  admin_grant: "Admin tặng",
};
export const topupLabel = (type: string) => TOPUP_LABELS[type] ?? "Nạp khác";

// ─── Định dạng VND compact cho trục biểu đồ (2.600.000 → "2,6tr") ────────────

export function formatVndCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(".", ",")}tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")}tr`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return `${value}`;
}

// ─── Kết quả tổng hợp ────────────────────────────────────────────────────────

export interface RevenueKpis {
  totalVnd: number; // Σ VND đã map trên các dòng nạp
  creditsSold: number; // Σ credit_delta trên các dòng nạp
  creditsSpent: number; // Σ |credit_delta| trên các dòng tiêu dùng
  payingUsers: number; // số user khác nhau có nạp
  purchaseCount: number; // số lượt nạp
  avgOrderVnd: number; // VND trung bình mỗi đơn (chỉ tính đơn có VND > 0)
}

export interface TimeBucket {
  key: string;
  label: string;
  vnd: number;
  credits: number;
}

export interface PackageStat {
  key: string;
  label: string;
  vnd: number;
  credits: number;
  count: number;
  vndKnown: boolean; // false với "Nạp khác"
}

export interface FeatureStat {
  type: string;
  label: string;
  credits: number;
  count: number;
}

export interface DetailRow {
  id: string;
  at: string;
  userName: string;
  userEmail: string;
  kind: "topup" | "spend";
  label: string; // tên gói (nạp) hoặc tên tính năng (tiêu dùng)
  credits: number; // có dấu
  vnd: number;
  vndKnown: boolean; // true chỉ khi nạp khớp gói
}

export interface TransactionReport {
  kpis: RevenueKpis;
  timeSeries: TimeBucket[];
  byPackage: PackageStat[];
  byFeature: FeatureStat[];
  transactions: DetailRow[];
}

// ─── Bucketing theo granularity ──────────────────────────────────────────────

function bucketKeyOf(date: Date, g: Granularity): string {
  if (g === "month") return format(date, "yyyy-MM");
  if (g === "week") return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
  return format(date, "yyyy-MM-dd");
}

function enumerateBuckets(from: Date, to: Date, g: Granularity): { key: string; label: string }[] {
  if (g === "month") {
    return eachMonthOfInterval({ start: from, end: to }).map((d) => ({
      key: format(d, "yyyy-MM"),
      label: format(d, "MM/yyyy"),
    }));
  }
  if (g === "week") {
    return eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 }).map((d) => {
      const start = startOfWeek(d, { weekStartsOn: 1 });
      return { key: format(start, "yyyy-MM-dd"), label: format(start, "dd/MM") };
    });
  }
  return eachDayOfInterval({ start: from, end: to }).map((d) => ({
    key: format(d, "yyyy-MM-dd"),
    label: format(d, "dd/MM"),
  }));
}

// ─── Hàm tổng hợp chính ──────────────────────────────────────────────────────

export function aggregateTransactionReport(
  rows: RawTxRow[],
  range: { from: Date; to: Date },
  granularity: Granularity,
): TransactionReport {
  const purchases = rows.filter(isPurchase);
  const consumptions = rows.filter(isConsumption);

  // KPIs
  let totalVnd = 0;
  let creditsSold = 0;
  let pricedOrders = 0;
  const payers = new Set<string>();
  for (const r of purchases) {
    const { vnd } = resolvePurchase(r);
    totalVnd += vnd;
    creditsSold += r.credit_delta;
    payers.add(r.user_id);
    if (vnd > 0) pricedOrders += 1;
  }
  const creditsSpent = consumptions.reduce((s, r) => s + Math.abs(r.credit_delta), 0);
  const kpis: RevenueKpis = {
    totalVnd,
    creditsSold,
    creditsSpent,
    payingUsers: payers.size,
    purchaseCount: purchases.length,
    avgOrderVnd: pricedOrders > 0 ? Math.round(totalVnd / pricedOrders) : 0,
  };

  // Time series (fill 0 để trục liên tục)
  const buckets = enumerateBuckets(range.from, range.to, granularity);
  const vndByBucket: Record<string, number> = {};
  const creditsByBucket: Record<string, number> = {};
  for (const r of purchases) {
    const key = bucketKeyOf(new Date(r.created_at), granularity);
    vndByBucket[key] = (vndByBucket[key] ?? 0) + resolvePurchase(r).vnd;
    creditsByBucket[key] = (creditsByBucket[key] ?? 0) + r.credit_delta;
  }
  const timeSeries: TimeBucket[] = buckets.map((b) => ({
    ...b,
    vnd: vndByBucket[b.key] ?? 0,
    credits: creditsByBucket[b.key] ?? 0,
  }));

  // Doanh thu theo gói
  const pkgMap = new Map<string, PackageStat>();
  for (const r of purchases) {
    const { vnd, packageKey, label } = resolvePurchase(r);
    const key = packageKey ?? "other";
    const cur =
      pkgMap.get(key) ??
      ({ key, label, vnd: 0, credits: 0, count: 0, vndKnown: packageKey !== null } as PackageStat);
    cur.vnd += vnd;
    cur.credits += r.credit_delta;
    cur.count += 1;
    pkgMap.set(key, cur);
  }
  // Sắp theo thứ tự gói trong CREDIT_PACKAGES, "Nạp khác" cuối cùng
  const order = CREDIT_PACKAGES.map((p) => p.key as string);
  const byPackage = [...pkgMap.values()].sort((a, b) => {
    const ia = a.key === "other" ? 999 : order.indexOf(a.key);
    const ib = b.key === "other" ? 999 : order.indexOf(b.key);
    return ia - ib;
  });

  // Tiêu dùng credit theo tính năng
  const featMap = new Map<string, FeatureStat>();
  for (const r of consumptions) {
    const cur =
      featMap.get(r.type) ??
      ({ type: r.type, label: featureLabel(r.type), credits: 0, count: 0 } as FeatureStat);
    cur.credits += Math.abs(r.credit_delta);
    cur.count += 1;
    featMap.set(r.type, cur);
  }
  const byFeature = [...featMap.values()].sort((a, b) => b.credits - a.credits);

  // Bảng chi tiết (mọi giao dịch, mới nhất trước)
  const transactions: DetailRow[] = rows
    .slice()
    .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    .map((r) => {
      const purchase = isPurchase(r);
      const resolved = purchase ? resolvePurchase(r) : null;
      // kind theo DẤU credit: cộng credit = topup (gồm cả admin_grant/thưởng), trừ = spend.
      const topup = r.credit_delta > 0;
      const label = purchase ? resolved!.label : topup ? topupLabel(r.type) : featureLabel(r.type);
      return {
        id: r.id,
        at: r.created_at,
        userName: r.profiles?.name?.trim() || r.profiles?.email || "—",
        userEmail: r.profiles?.email ?? "",
        kind: (topup ? "topup" : "spend") as "topup" | "spend",
        label,
        credits: r.credit_delta,
        vnd: resolved?.vnd ?? 0,
        vndKnown: purchase && resolved!.packageKey !== null,
      };
    });

  return { kpis, timeSeries, byPackage, byFeature, transactions };
}
