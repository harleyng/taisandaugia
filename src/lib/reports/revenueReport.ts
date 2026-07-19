// Tổng hợp báo cáo Doanh thu tổng từ MỘT nguồn duy nhất: bảng `orders`.
//
// Từ 20260719000003, mỗi giao dịch nạp credit sinh đúng một dòng orders
// (trigger credit_transactions_create_order, orders.credit_transaction_id UNIQUE),
// nên không còn phải suy doanh thu credit từ ledger lúc chạy báo cáo — và không
// còn hai đường cộng song song để lệch nhau.
//
// Ý nghĩa cột tiền (áp cho MỌI kind):
//   amount       = tiền THỰC VỀ SÀN → đây là con số cộng vào doanh thu
//   gross_amount = giá trị hợp đồng (GMV) → chỉ số phụ, KHÔNG cộng vào tổng
// Với hoa hồng: amount = phần sàn ăn (net), gross_amount = tiền khách trả NCC.
// Vì vậy "Giá trị hợp đồng môi giới" là tile RIÊNG, cố ý tách khỏi nhóm doanh thu.
//
// Đơn 'cancelled' không tính doanh thu.
//
// Module thuần: không import React / Supabase.

import {
  enumerateBuckets,
  bucketKeyOf,
  type Granularity,
} from "./transactionReport";
import { SOURCE_LABELS, type RevenueSource } from "./revenueSource";

export type { RevenueSource };

/** Một dòng đơn hàng rút gọn cho báo cáo doanh thu. */
export interface OrderRevenueRow {
  id: string;
  amount: number | string;
  gross_amount: number | string;
  /** Snapshot lúc chốt đơn — KHÔNG đọc service.kind (join live sẽ sai hồi tố). */
  service_kind: RevenueSource;
  ordered_at: string;
  fulfillment_status: "pending" | "fulfilled" | "cancelled";
  service: { id: string; name: string; audience?: string | null } | null;
  variant: { id: string; name: string; variant_key: string } | null;
}

export interface RevenueKpis {
  totalVnd: number;
  creditVnd: number;
  directVnd: number;
  commissionVnd: number;
  /** Tổng giá trị hợp đồng môi giới (GMV). KHÔNG nằm trong totalVnd. */
  grossBrokeredVnd: number;
  orderCount: number;
  growthPct: number | null;
}

export interface SourceStat {
  source: RevenueSource;
  label: string;
  vnd: number;
  share: number;
}

export interface RevenueBucket {
  key: string;
  label: string;
  creditVnd: number;
  directVnd: number;
  commissionVnd: number;
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
  audience: string;
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

const AUDIENCE_LABELS: Record<string, string> = {
  buyer: "Người mua",
  owner: "Chủ tài sản",
  company: "Công ty đấu giá",
  all: "Dùng chung",
  direct: "Dịch vụ trực tiếp",
  commission: "Hoa hồng môi giới",
  unknown: "Khác",
};

const num = (v: number | string | null | undefined): number => Number(v ?? 0);

export function aggregateRevenueReport(
  orders: OrderRevenueRow[],
  range: { from: Date; to: Date },
  granularity: Granularity,
): RevenueReport {
  const rows = orders.filter((o) => o.fulfillment_status !== "cancelled");

  const sumWhere = (kind: RevenueSource) =>
    rows.filter((o) => o.service_kind === kind).reduce((s, o) => s + num(o.amount), 0);

  const creditVnd = sumWhere("credit");
  const directVnd = sumWhere("direct");
  const commissionVnd = sumWhere("commission");
  const totalVnd = creditVnd + directVnd + commissionVnd;

  // GMV chỉ tính trên hàng hoa hồng — không lọc thì mọi đơn direct/credit sẽ
  // thành "giá trị môi giới" ngay ngày đầu.
  const grossBrokeredVnd = rows
    .filter((o) => o.service_kind === "commission")
    .reduce((s, o) => s + num(o.gross_amount), 0);

  const bySource: SourceStat[] = (["credit", "direct", "commission"] as RevenueSource[]).map(
    (source) => {
      const vnd = source === "credit" ? creditVnd : source === "direct" ? directVnd : commissionVnd;
      return { source, label: SOURCE_LABELS[source], vnd, share: totalVnd > 0 ? vnd / totalVnd : 0 };
    },
  );

  // Time series (zero-fill để trục liên tục)
  const buckets = enumerateBuckets(range.from, range.to, granularity);
  const byBucket: Record<string, { credit: number; direct: number; commission: number }> = {};
  for (const o of rows) {
    const key = bucketKeyOf(new Date(o.ordered_at), granularity);
    const cur = (byBucket[key] ??= { credit: 0, direct: 0, commission: 0 });
    cur[o.service_kind] += num(o.amount);
  }
  const timeSeries: RevenueBucket[] = buckets.map((b) => {
    const c = byBucket[b.key] ?? { credit: 0, direct: 0, commission: 0 };
    return {
      ...b,
      creditVnd: c.credit,
      directVnd: c.direct,
      commissionVnd: c.commission,
      totalVnd: c.credit + c.direct + c.commission,
    };
  });

  // Tăng trưởng kỳ cuối so với kỳ liền trước
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
    commissionVnd,
    grossBrokeredVnd,
    orderCount: rows.length,
    growthPct,
  };

  // Theo dịch vụ + theo biến thể + theo đối tượng
  const svcMap = new Map<string, RevenueServiceStat>();
  const variantMap = new Map<string, RevenueServiceStat>();
  const audMap = new Map<string, number>();

  for (const o of rows) {
    const vnd = num(o.amount);
    const source = o.service_kind;

    const svcKey = `${source}:${o.service?.id ?? "unknown"}`;
    const svc =
      svcMap.get(svcKey) ??
      ({
        key: svcKey,
        label: o.service?.name ?? "Dịch vụ khác",
        source,
        audience: o.service?.audience ?? null,
        vnd: 0,
        count: 0,
      } as RevenueServiceStat);
    svc.vnd += vnd;
    svc.count += 1;
    svcMap.set(svcKey, svc);

    if (o.variant) {
      const vKey = o.variant.variant_key;
      const v =
        variantMap.get(vKey) ??
        ({ key: vKey, label: o.variant.name, source, audience: o.service?.audience ?? null, vnd: 0, count: 0 } as RevenueServiceStat);
      v.vnd += vnd;
      v.count += 1;
      variantMap.set(vKey, v);
    }

    // Đối tượng: credit theo audience của nhóm; direct/hoa hồng có bucket riêng.
    const aud = source === "credit" ? (o.service?.audience ?? "unknown") : source;
    audMap.set(aud, (audMap.get(aud) ?? 0) + vnd);
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
