// Định dạng báo cáo "Phân tích truy cập" từ JSONB của RPC admin_access_report.
//
// Server đã tổng hợp sẵn (bucket theo date_trunc). Module này chỉ:
//  - zero-fill trục thời gian cho liên tục (tái dùng pattern enumerateBuckets),
//  - gắn nhãn tiếng Việt cho thiết bị / tính năng,
//  - tính % chuyển đổi funnel.
// Module THUẦN: không import React / Supabase.

import {
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  startOfWeek,
  format,
} from "date-fns";
import type { Granularity } from "@/lib/reports/transactionReport";
import { featureEventLabel } from "@/lib/analytics/featureLabels";

// ─── Shape JSONB trả về từ RPC ───────────────────────────────────────────────
export interface RawAccessReport {
  timeseries: { bucket: string; visits: number; page_views: number; unique_users: number }[];
  topPages: { path: string; views: number; unique_users: number }[];
  byFeature: { feature_key: string; count: number; unique_users: number }[];
  byDevice: { device_type: string; count: number }[];
  byProvince: { province: string; count: number }[];
  funnel: { visitors: number; registrations: number; activations: number; spenders: number };
  kpis: { totalVisits: number; totalPageViews: number; uniqueUsers: number; featureEvents: number };
}

// ─── Kết quả đã định dạng cho UI ─────────────────────────────────────────────
export interface AccessTimeBucket {
  key: string;
  label: string;
  visits: number;
  pageViews: number;
  uniqueUsers: number;
}
export interface PageStat {
  path: string;
  views: number;
  uniqueUsers: number;
}
export interface FeatureUsageStat {
  key: string;
  label: string;
  count: number;
  uniqueUsers: number;
}
export interface DeviceStat {
  key: string;
  label: string;
  count: number;
}
export interface ProvinceStat {
  province: string;
  count: number;
}
export interface FunnelStage {
  key: string;
  label: string;
  value: number;
  pctOfTop: number; // % so với đỉnh phễu (khách truy cập)
  pctOfPrev: number | null; // % so với bước liền trước
}
export interface AccessKpis {
  totalVisits: number;
  totalPageViews: number;
  uniqueUsers: number;
  featureEvents: number;
}
export interface AccessReport {
  kpis: AccessKpis;
  timeSeries: AccessTimeBucket[];
  topPages: PageStat[];
  byFeature: FeatureUsageStat[];
  byDevice: DeviceStat[];
  byProvince: ProvinceStat[];
  funnel: FunnelStage[];
}

// ─── Bucketing (đồng bộ với transactionReport) ───────────────────────────────
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

// ─── Nhãn thiết bị ───────────────────────────────────────────────────────────
const DEVICE_LABELS: Record<string, string> = {
  desktop: "Máy tính",
  mobile: "Điện thoại",
  tablet: "Máy tính bảng",
  unknown: "Không rõ",
};
const deviceLabel = (k: string) => DEVICE_LABELS[k] ?? k;

const FUNNEL_LABELS: { key: keyof RawAccessReport["funnel"]; label: string }[] = [
  { key: "visitors", label: "Truy cập" },
  { key: "registrations", label: "Đăng ký" },
  { key: "activations", label: "Kích hoạt" },
  { key: "spenders", label: "Tiêu credit" },
];

const EMPTY: RawAccessReport = {
  timeseries: [],
  topPages: [],
  byFeature: [],
  byDevice: [],
  byProvince: [],
  funnel: { visitors: 0, registrations: 0, activations: 0, spenders: 0 },
  kpis: { totalVisits: 0, totalPageViews: 0, uniqueUsers: 0, featureEvents: 0 },
};

// ─── Hàm định dạng chính ─────────────────────────────────────────────────────
export function formatAccessReport(
  raw: RawAccessReport | null | undefined,
  range: { from: Date; to: Date },
  granularity: Granularity,
): AccessReport {
  const r = raw ?? EMPTY;

  // Zero-fill trục thời gian
  const buckets = enumerateBuckets(range.from, range.to, granularity);
  const byKey = new Map<string, RawAccessReport["timeseries"][number]>();
  for (const t of r.timeseries ?? []) {
    byKey.set(bucketKeyOf(new Date(t.bucket), granularity), t);
  }
  const timeSeries: AccessTimeBucket[] = buckets.map((b) => {
    const hit = byKey.get(b.key);
    return {
      key: b.key,
      label: b.label,
      visits: Number(hit?.visits ?? 0),
      pageViews: Number(hit?.page_views ?? 0),
      uniqueUsers: Number(hit?.unique_users ?? 0),
    };
  });

  const topPages: PageStat[] = (r.topPages ?? []).map((p) => ({
    path: p.path,
    views: Number(p.views),
    uniqueUsers: Number(p.unique_users),
  }));

  const byFeature: FeatureUsageStat[] = (r.byFeature ?? []).map((f) => ({
    key: f.feature_key,
    label: featureEventLabel(f.feature_key),
    count: Number(f.count),
    uniqueUsers: Number(f.unique_users),
  }));

  const byDevice: DeviceStat[] = (r.byDevice ?? []).map((d) => ({
    key: d.device_type,
    label: deviceLabel(d.device_type),
    count: Number(d.count),
  }));

  // "Không rõ" xuống cuối bảng tỉnh
  const byProvince: ProvinceStat[] = (r.byProvince ?? [])
    .map((p) => ({ province: p.province, count: Number(p.count) }))
    .sort((a, b) => {
      if (a.province === "Không rõ") return 1;
      if (b.province === "Không rõ") return -1;
      return b.count - a.count;
    });

  const top = Number(r.funnel?.visitors ?? 0);
  let prev: number | null = null;
  const funnel: FunnelStage[] = FUNNEL_LABELS.map(({ key, label }) => {
    const value = Number(r.funnel?.[key] ?? 0);
    const stage: FunnelStage = {
      key,
      label,
      value,
      pctOfTop: top > 0 ? (value / top) * 100 : 0,
      pctOfPrev: prev === null ? null : prev > 0 ? (value / prev) * 100 : 0,
    };
    prev = value;
    return stage;
  });

  const kpis: AccessKpis = {
    totalVisits: Number(r.kpis?.totalVisits ?? 0),
    totalPageViews: Number(r.kpis?.totalPageViews ?? 0),
    uniqueUsers: Number(r.kpis?.uniqueUsers ?? 0),
    featureEvents: Number(r.kpis?.featureEvents ?? 0),
  };

  return { kpis, timeSeries, topPages, byFeature, byDevice, byProvince, funnel };
}
