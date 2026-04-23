// Pure functions for auction price history analysis (AC1–AC7)
// All inputs are arrays of session prices in same unit (tr/m² or VND total).

export interface RawSession {
  date: Date;
  price: number; // in display unit (e.g. tr/m² for real estate)
  area?: number;
  district?: string;
  property_type?: string;
}

export interface MonthBucket {
  // 1-based month label e.g. "T3/25"
  label: string;
  year: number;
  month: number; // 0-11
  count: number;
  min: number;
  max: number;
  median: number;
  p25?: number;
  p75?: number;
  // chart-ready values (decided by count >= 8)
  low: number;
  mid: number;
  high: number;
  usesPercentile: boolean;
}

// ---------- Area buckets (BLOCK 1 — AC2) ----------
export interface AreaBucket {
  key: string;
  min: number;
  max: number;
}

export const AREA_BUCKETS: AreaBucket[] = [
  { key: "<40", min: 0, max: 40 },
  { key: "40-60", min: 40, max: 60 },
  { key: "60-80", min: 60, max: 80 },
  { key: "80-120", min: 80, max: 120 },
  { key: ">120", min: 120, max: Infinity },
];

export const pickBucket = (area: number): AreaBucket | null => {
  if (!Number.isFinite(area) || area <= 0) return null;
  const a = Math.round(area);
  return AREA_BUCKETS.find((b) => a >= b.min && a < b.max) ?? AREA_BUCKETS[AREA_BUCKETS.length - 1];
};

export type AreaMode = "area-bucket" | "no-area";

export interface AreaResolution {
  mode: AreaMode;
  bucketLabel?: string;
  bucketRange?: [number, number];
  mergedFrom?: string[];
  skipPosition?: boolean;
  reason?: "invalid-area" | "outlier" | "sparse" | "ok";
  filteredSessions: RawSession[];
}

const MIN_BUCKET_COUNT = 5;

/** Resolve which subset of sessions to use, based on assetArea + data density (AC1, AC3, AC7). */
export const resolveAreaSubset = (sessions: RawSession[], assetArea: number): AreaResolution => {
  // AC1: invalid area → no-area mode
  if (!Number.isFinite(assetArea) || assetArea <= 0) {
    return { mode: "no-area", reason: "invalid-area", filteredSessions: sessions };
  }

  // AC7a: outlier check (3× median area of the regional set)
  const areas = sessions.map((s) => s.area).filter((a): a is number => typeof a === "number" && a > 0);
  if (areas.length >= 4) {
    const medArea = percentile(sortedAsc(areas), 0.5);
    if (medArea > 0 && assetArea > medArea * 3) {
      return { mode: "no-area", reason: "outlier", filteredSessions: sessions };
    }
  }

  const startBucket = pickBucket(assetArea);
  if (!startBucket) {
    return { mode: "no-area", reason: "invalid-area", filteredSessions: sessions };
  }

  const sessionsInBucket = (b: AreaBucket) =>
    sessions.filter((s) => typeof s.area === "number" && s.area! >= b.min && s.area! < b.max);

  // AC2: try exact bucket first
  let active: AreaBucket[] = [startBucket];
  let filtered = sessionsInBucket(startBucket);

  if (filtered.length < MIN_BUCKET_COUNT) {
    // AC3: merge with neighbours (prefer side closer to regional median area)
    const startIdx = AREA_BUCKETS.indexOf(startBucket);
    const medArea = areas.length ? percentile(sortedAsc(areas), 0.5) : assetArea;

    const neighbours: AreaBucket[] = [];
    const lower = AREA_BUCKETS[startIdx - 1];
    const upper = AREA_BUCKETS[startIdx + 1];
    // priority: neighbour whose mid is closer to median
    const midOf = (b: AreaBucket) => (b.max === Infinity ? b.min + 60 : (b.min + b.max) / 2);
    const candidates = [lower, upper].filter(Boolean) as AreaBucket[];
    candidates.sort((a, b) => Math.abs(midOf(a) - medArea) - Math.abs(midOf(b) - medArea));
    neighbours.push(...candidates);

    for (const n of neighbours) {
      active = [...active, n].sort((a, b) => a.min - b.min);
      filtered = active.flatMap(sessionsInBucket);
      if (filtered.length >= MIN_BUCKET_COUNT) break;
    }
  }

  if (filtered.length < MIN_BUCKET_COUNT) {
    return { mode: "no-area", reason: "sparse", filteredSessions: sessions };
  }

  // Build merged label/range
  active.sort((a, b) => a.min - b.min);
  const min = active[0].min;
  const maxRaw = active[active.length - 1].max;
  const label = active.length === 1
    ? active[0].key
    : maxRaw === Infinity
      ? `>${min}`
      : `${min}-${maxRaw}`;
  const mergedFrom = active.length > 1 ? active.map((b) => b.key) : undefined;

  // AC7b: bucket merged across >2 base buckets → skip position
  const skipPosition = active.length > 2;

  return {
    mode: "area-bucket",
    bucketLabel: label,
    bucketRange: [min, maxRaw === Infinity ? min + 60 : maxRaw],
    mergedFrom,
    skipPosition,
    reason: "ok",
    filteredSessions: filtered,
  };
};

export interface AnalyticsResult {
  buckets: MonthBucket[];
  countTotal: number;
  count3M: number;
  count6M: number;
  count12M: number;
  median12M: number;
  min12M: number;
  max12M: number;
  trend3M: number; // -1..+inf, fraction
  trend6M: number;
  volatility: number; // coefficient of variation on monthly medians (6-12M window)
  noisy: boolean; // true if outlier filter reverted
  // BLOCK 1 additions
  areaMode: AreaMode;
  bucketLabel?: string;
  bucketRange?: [number, number];
  mergedFrom?: string[];
  skipPosition?: boolean;
  areaReason?: AreaResolution["reason"];
}

// ---------- Statistics ----------

const sortedAsc = (arr: number[]) => [...arr].sort((a, b) => a - b);

export const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
};

export const median = (arr: number[]): number => percentile(sortedAsc(arr), 0.5);

const mean = (arr: number[]): number => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

const stdev = (arr: number[]): number => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((acc, x) => acc + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
};

// ---------- IQR Outlier filter (AC7) ----------

export const removeIQROutliers = (sessions: RawSession[]): { kept: RawSession[]; removed: number } => {
  if (sessions.length < 4) return { kept: sessions, removed: 0 };
  const sorted = sortedAsc(sessions.map((s) => s.price));
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const kept = sessions.filter((s) => s.price >= lo && s.price <= hi);
  return { kept, removed: sessions.length - kept.length };
};

// ---------- Month bucketing ----------

const monthLabel = (year: number, monthIdx0: number) => `T${monthIdx0 + 1}/${String(year).slice(-2)}`;

export const groupByMonth = (sessions: RawSession[]): MonthBucket[] => {
  const map = new Map<string, RawSession[]>();
  for (const s of sessions) {
    const key = `${s.date.getFullYear()}-${s.date.getMonth()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  const buckets: MonthBucket[] = [];
  for (const [key, list] of map) {
    const [y, m] = key.split("-").map(Number);
    const prices = sortedAsc(list.map((x) => x.price));
    const count = prices.length;
    const med = percentile(prices, 0.5);
    const p25 = percentile(prices, 0.25);
    const p75 = percentile(prices, 0.75);
    const min = prices[0];
    const max = prices[prices.length - 1];
    const usesPercentile = count >= 8;
    buckets.push({
      label: monthLabel(y, m),
      year: y,
      month: m,
      count,
      min,
      max,
      median: med,
      p25: usesPercentile ? p25 : undefined,
      p75: usesPercentile ? p75 : undefined,
      low: usesPercentile ? p25 : min,
      mid: med,
      high: usesPercentile ? p75 : max,
      usesPercentile,
    });
  }
  buckets.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
  return buckets;
};

// ---------- Filter to last N months ----------

export const sessionsWithinMonths = (sessions: RawSession[], months: number, now = new Date()): RawSession[] => {
  const cutoff = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  return sessions.filter((s) => s.date >= cutoff);
};

// ---------- Aggregate analytics ----------

export const computeAnalytics = (sessions12M: RawSession[], assetArea?: number): AnalyticsResult => {
  // BLOCK 1: resolve area subset first (AC1, AC3, AC7)
  const resolved = resolveAreaSubset(sessions12M, assetArea ?? 0);
  const baseSessions = resolved.filteredSessions;

  // IQR clean (AC7)
  const { kept } = removeIQROutliers(baseSessions);
  const noisy = kept.length < 5 && baseSessions.length >= 5;
  const useSet = noisy ? baseSessions : kept;

  const buckets12 = groupByMonth(useSet);
  const all = useSet.map((s) => s.price);
  const sorted = sortedAsc(all);
  const min12M = sorted[0] ?? 0;
  const max12M = sorted[sorted.length - 1] ?? 0;
  const median12M = percentile(sorted, 0.5);

  // counts per range
  const count3M = sessionsWithinMonths(useSet, 3).length;
  const count6M = sessionsWithinMonths(useSet, 6).length;
  const count12M = useSet.length;

  // trends — compare first vs last bucket median in window
  const trend = (months: number): number => {
    const within = sessionsWithinMonths(useSet, months);
    const bs = groupByMonth(within);
    if (bs.length < 2) return 0;
    const first = bs[0].median;
    const last = bs[bs.length - 1].median;
    return first > 0 ? (last - first) / first : 0;
  };

  // volatility on 6-12M monthly medians
  const last12 = buckets12.slice(-12).map((b) => b.median);
  const m = mean(last12);
  const volatility = m > 0 ? stdev(last12) / m : 0;

  return {
    buckets: buckets12,
    countTotal: useSet.length,
    count3M,
    count6M,
    count12M,
    median12M,
    min12M,
    max12M,
    trend3M: trend(3),
    trend6M: trend(6),
    volatility,
    noisy,
    areaMode: resolved.mode,
    bucketLabel: resolved.bucketLabel,
    bucketRange: resolved.bucketRange,
    mergedFrom: resolved.mergedFrom,
    skipPosition: resolved.skipPosition,
    areaReason: resolved.reason,
  };
};

// ---------- Insight generation (AC5, AC6) ----------

export type VolatilityLevel = "low" | "medium" | "high";
export type PositionLevel = "low" | "medium" | "high";
export type TrendDirection = "up" | "down" | "flat";

export const volatilityLevel = (v: number): VolatilityLevel => {
  if (v >= 0.5) return "high";
  if (v >= 0.2) return "medium";
  return "low";
};

export const trendDirection = (t: number): TrendDirection => {
  if (t >= 0.03) return "up";
  if (t <= -0.03) return "down";
  return "flat";
};

export const computePosition = (predictedMid: number, min12M: number, max12M: number): number => {
  if (max12M <= min12M) return 0.5;
  const p = (predictedMid - min12M) / (max12M - min12M);
  return Math.max(0, Math.min(1, p));
};

export const positionLevel = (p: number): PositionLevel => {
  if (p <= 0.33) return "low";
  if (p <= 0.66) return "medium";
  return "high";
};

export interface InsightBullet {
  text: string;
  implication?: string;
}

export interface InsightPayload {
  title: string;
  bullets: InsightBullet[];
}

const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1).replace(".", ",")}%`;

const areaCtxPrefix = (a: AnalyticsResult) =>
  a.areaMode === "area-bucket" && a.bucketLabel ? `Nhóm ${a.bucketLabel} m²: ` : "";
const areaCtxSuffix = (a: AnalyticsResult) =>
  a.areaMode === "no-area" ? " (không phân theo diện tích)" : "";

export const buildInsightModeA = (a: AnalyticsResult): InsightPayload => {
  const dir = trendDirection(a.trend6M);
  const trendBody =
    dir === "up"
      ? `giá trúng có xu hướng tăng trong 6 tháng gần đây (${fmtPct(a.trend6M)})`
      : dir === "down"
        ? `giá trúng có xu hướng giảm trong 6 tháng gần đây (${fmtPct(a.trend6M)})`
        : `giá trúng đi ngang trong 6 tháng gần đây (${fmtPct(a.trend6M)})`;
  const trendText = `${areaCtxPrefix(a)}${trendBody}.${areaCtxSuffix(a)}`;

  const vl = volatilityLevel(a.volatility);
  const volBody =
    vl === "high"
      ? "thị trường biến động mạnh — giá có thể chênh lệch lớn giữa các phiên"
      : vl === "medium"
        ? "mức biến động trung bình — giá khá ổn định nhưng vẫn có dao động"
        : "mức biến động thấp — giá ổn định giữa các phiên đấu giá";
  const volText = `${areaCtxPrefix(a)}${volBody}.${areaCtxSuffix(a)}`;

  return {
    title: "Xu hướng giá đấu giá",
    bullets: [{ text: trendText }, { text: volText }],
  };
};

export const buildInsightModeB = (a: AnalyticsResult, predictedMid: number): InsightPayload => {
  // AC7b: if skipPosition flag, fall back to Mode A
  if (a.skipPosition) return buildInsightModeA(a);

  const pos = computePosition(predictedMid, a.min12M, a.max12M);
  const pl = positionLevel(pos);
  const vl = volatilityLevel(a.volatility);
  const dir = trendDirection(a.trend6M);

  const ctxNote =
    a.areaMode === "area-bucket" && a.bucketLabel
      ? ` so với các tài sản cùng diện tích (${a.bucketLabel} m²)`
      : "";

  const posText =
    pl === "low"
      ? `Giá dự đoán đang ở vùng thấp của 12 tháng${ctxNote} (${Math.round(pos * 100)}% dải giá).${areaCtxSuffix(a)}`
      : pl === "medium"
        ? `Giá dự đoán nằm ở vùng giữa của 12 tháng${ctxNote} (${Math.round(pos * 100)}% dải giá).${areaCtxSuffix(a)}`
        : `Giá dự đoán đang ở vùng cao của 12 tháng${ctxNote} (${Math.round(pos * 100)}% dải giá).${areaCtxSuffix(a)}`;

  const trendText =
    dir === "up"
      ? `${areaCtxPrefix(a)}xu hướng 6 tháng đang tăng (${fmtPct(a.trend6M)}).${areaCtxSuffix(a)}`
      : dir === "down"
        ? `${areaCtxPrefix(a)}xu hướng 6 tháng đang giảm (${fmtPct(a.trend6M)}).${areaCtxSuffix(a)}`
        : `${areaCtxPrefix(a)}xu hướng 6 tháng đi ngang (${fmtPct(a.trend6M)}).${areaCtxSuffix(a)}`;

  let lastBullet: InsightBullet;
  if (vl === "high") {
    lastBullet = {
      text: "Thị trường biến động mạnh.",
      implication: "Cân nhắc kỹ ngưỡng giá tối đa trước khi tham gia.",
    };
  } else if (pl === "low" && dir !== "down") {
    lastBullet = {
      text: "Cơ hội giá tốt so với mặt bằng 12 tháng.",
      implication: "Có thể là điểm tham gia hấp dẫn.",
    };
  } else if (pl === "high") {
    lastBullet = {
      text: "Giá đang gần đỉnh dải 12 tháng.",
      implication: "Cân nhắc rủi ro mua đỉnh.",
    };
  } else {
    lastBullet = {
      text:
        vl === "low"
          ? "Mức biến động thấp — giá đang ổn định."
          : "Mức biến động trung bình — vẫn còn dao động vừa phải.",
      implication: "Có thể tham chiếu khoảng giá phổ biến để đặt mức bid.",
    };
  }

  return {
    title: "Insight thị trường",
    bullets: [{ text: posText }, { text: trendText }, lastBullet],
  };
};

// Short single-line teaser used by the paywall (AC8)
export const buildPaywallTeaser = (a: AnalyticsResult): string => {
  const dir = trendDirection(a.trend3M || a.trend6M);
  if (dir === "up") return "Giá khu vực đang có xu hướng tăng gần đây.";
  if (dir === "down") return "Giá khu vực đang giảm trong những tháng gần đây.";
  return "Giá khu vực ổn định trong vài tháng gần đây.";
};
