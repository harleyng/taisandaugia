// Tổng hợp báo cáo Doanh thu tổng — hợp nhất 2 nguồn tiền vào:
//   (1) Credit: khách NẠP mua gói (ledger credit_transactions, type='purchase',
//       credit_delta > 0) — VND suy ra qua resolvePurchase theo CREDIT_PACKAGES.
//   (2) Trực tiếp: đơn hàng dịch vụ direct (bảng orders), VND = amount.
//
// Nguyên tắc kế toán: credit ghi nhận doanh thu LÚC NẠP, KHÔNG tính lại lúc tiêu
// credit cho tính năng → tránh cộng trùng. Đơn 'cancelled' không tính doanh thu.
//
// Module thuần: không import React / Supabase. Tái dùng logic của transactionReport.

import {
  isPurchase,
  resolvePurchase,
  enumerateBuckets,
  bucketKeyOf,
  type RawTxRow,
  type Granularity,
} from "./transactionReport";

export type RevenueSource = "credit" | "direct";

/** Một dòng đơn hàng rút gọn cho báo cáo doanh thu. */
export interface OrderRevenueRow {
  id: string;
  amount: number | string;
  ordered_at: string;
  fulfillment_status: "pending" | "fulfilled" | "cancelled";
  service: { id: string; name: string } | null;
}

export interface RevenueKpis {
  totalVnd: number;
  creditVnd: number;
  directVnd: number;
  orderCount: number;
  growthPct: number | null; // % tăng trưởng kỳ cuối so với kỳ trước (theo timeSeries)
}

export interface SourceStat {
  source: RevenueSource;
  label: string;
  vnd: number;
  share: number; // 0..1 theo tổng doanh thu
}

export interface RevenueBucket {
  key: string;
  label: string;
  creditVnd: number;
  directVnd: number;
  totalVnd: number;
}

export interface RevenueServiceStat {
  key: string;
  label: string;
  source: RevenueSource;
  audience?: string | null;
  vnd: number;
  count: number;
}

export interface AudienceStat {
  audience: string; // buyer|owner|company|direct
  label: string;
  vnd: number;
  share: number;
}

export interface RevenueReport {
  kpis: RevenueKpis;
  bySource: SourceStat[];
  byAudience: AudienceStat[];
  timeSeries: RevenueBucket[];
  byService: RevenueServiceStat[];
  topVariants: RevenueServiceStat[];
}

const SOURCE_LABELS: Record<RevenueSource, string> = {
  credit: "Nạp credit",
  direct: "Dịch vụ trực tiếp",
};

const AUDIENCE_LABELS: Record<string, string> = {
  buyer: "Người mua",
  owner: "Chủ tài sản",
  company: "Công ty đấu giá",
  all: "Dùng chung",
  direct: "Dịch vụ trực tiếp",
  unknown: "Khác",
};

export function aggregateRevenueReport(
  txRows: RawTxRow[],
  orders: OrderRevenueRow[],
  range: { from: Date; to: Date },
  granularity: Granularity,
): RevenueReport {
  const purchases = txRows.filter(isPurchase);
  const directOrders = orders.filter((o) => o.fulfillment_status !== "cancelled");

  // KPIs
  const creditVnd = purchases.reduce((s, r) => s + resolvePurchase(r).vnd, 0);
  const directVnd = directOrders.reduce((s, o) => s + Number(o.amount ?? 0), 0);
  const totalVnd = creditVnd + directVnd;

  // Theo nguồn
  const bySource: SourceStat[] = [
    { source: "credit", label: SOURCE_LABELS.credit, vnd: creditVnd, share: totalVnd > 0 ? creditVnd / totalVnd : 0 },
    { source: "direct", label: SOURCE_LABELS.direct, vnd: directVnd, share: totalVnd > 0 ? directVnd / totalVnd : 0 },
  ];

  // Time series (zero-fill để trục liên tục)
  const buckets = enumerateBuckets(range.from, range.to, granularity);
  const creditByBucket: Record<string, number> = {};
  const directByBucket: Record<string, number> = {};
  for (const r of purchases) {
    const key = bucketKeyOf(new Date(r.created_at), granularity);
    creditByBucket[key] = (creditByBucket[key] ?? 0) + resolvePurchase(r).vnd;
  }
  for (const o of directOrders) {
    const key = bucketKeyOf(new Date(o.ordered_at), granularity);
    directByBucket[key] = (directByBucket[key] ?? 0) + Number(o.amount ?? 0);
  }
  const timeSeries: RevenueBucket[] = buckets.map((b) => {
    const c = creditByBucket[b.key] ?? 0;
    const d = directByBucket[b.key] ?? 0;
    return { ...b, creditVnd: c, directVnd: d, totalVnd: c + d };
  });

  // Tăng trưởng kỳ cuối so với kỳ liền trước (bỏ qua các kỳ 0 ở đầu chuỗi)
  const nonEmpty = timeSeries.filter((b) => b.totalVnd > 0);
  let growthPct: number | null = null;
  if (timeSeries.length >= 2) {
    const last = timeSeries[timeSeries.length - 1].totalVnd;
    const prev = timeSeries[timeSeries.length - 2].totalVnd;
    if (prev > 0) growthPct = Math.round(((last - prev) / prev) * 100);
    else if (last > 0 && nonEmpty.length > 0) growthPct = 100;
  }

  const kpis: RevenueKpis = {
    totalVnd,
    creditVnd,
    directVnd,
    orderCount: directOrders.length,
    growthPct,
  };

  // Theo dịch vụ (gộp gói credit + dịch vụ direct, phân biệt bằng cột source)
  const svcMap = new Map<string, RevenueServiceStat>();
  // Theo biến thể (top gói) + theo đối tượng — chỉ phía credit
  const variantMap = new Map<string, RevenueServiceStat>();
  const audMap = new Map<string, number>();
  for (const r of purchases) {
    const { vnd, packageKey, label, audience, groupName } = resolvePurchase(r);
    const svcKey = `credit:${groupName ?? "Nạp credit"}`;
    const svc =
      svcMap.get(svcKey) ??
      ({ key: svcKey, label: groupName ?? "Nạp credit", source: "credit", vnd: 0, count: 0 } as RevenueServiceStat);
    svc.vnd += vnd;
    svc.count += 1;
    svcMap.set(svcKey, svc);

    const vKey = packageKey ?? "other";
    const v =
      variantMap.get(vKey) ??
      ({ key: vKey, label, source: "credit", audience, vnd: 0, count: 0 } as RevenueServiceStat);
    v.vnd += vnd;
    v.count += 1;
    variantMap.set(vKey, v);

    const aud = audience ?? "unknown";
    audMap.set(aud, (audMap.get(aud) ?? 0) + vnd);
  }
  for (const o of directOrders) {
    const key = `direct:${o.service?.id ?? "unknown"}`;
    const cur =
      svcMap.get(key) ??
      ({ key, label: o.service?.name ?? "Dịch vụ khác", source: "direct", vnd: 0, count: 0 } as RevenueServiceStat);
    cur.vnd += Number(o.amount ?? 0);
    cur.count += 1;
    svcMap.set(key, cur);
    audMap.set("direct", (audMap.get("direct") ?? 0) + Number(o.amount ?? 0));
  }
  const byService = [...svcMap.values()].sort((a, b) => b.vnd - a.vnd);
  const topVariants = [...variantMap.values()].sort((a, b) => b.vnd - a.vnd).slice(0, 8);
  const byAudience: AudienceStat[] = [...audMap.entries()]
    .map(([audience, vnd]) => ({
      audience,
      label: AUDIENCE_LABELS[audience] ?? audience,
      vnd,
      share: totalVnd > 0 ? vnd / totalVnd : 0,
    }))
    .sort((a, b) => b.vnd - a.vnd);

  return { kpis, bySource, byAudience, timeSeries, byService, topVariants };
}
