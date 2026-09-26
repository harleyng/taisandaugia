// So sánh ẩn danh với các chi nhánh cùng hệ thống — docs/owner-control-tower-plan.md
// Phase 14. Số do RPC owner_ws_benchmark tính (migration 20260926185917); ở đây chỉ
// đọc payload và dựng câu / hình.
//
// Luật ẩn danh (ở SQL, KHÔNG tính lại ở client):
//   < 3 chi nhánh có số liệu ⇒ chỉ số là null;
//   3–4 ⇒ chỉ biết tốt hơn / ngang / kém hơn trung vị (tứ phân vị của 3 giá trị giải
//         ngược ra được số từng chi nhánh);
//   ≥ 5 ⇒ thêm tứ phân vị (tỷ lệ làm tròn 5 điểm, ngày làm tròn 1).

export type BenchmarkPosition = "better" | "same" | "worse";

export interface BenchmarkMetric {
  /** Số chi nhánh (kể cả mình) có số liệu cho chỉ số này. */
  n: number;
  /** null khi chính mình chưa đủ số liệu (chỉ xảy ra ở n ≥ 5). */
  position: BenchmarkPosition | null;
  self?: number | null;
  p25?: number;
  p50?: number;
  p75?: number;
}

export interface OwnerBenchmark {
  available: boolean;
  windowDays: number;
  successRate: BenchmarkMetric | null;
  daysToSale: BenchmarkMetric | null;
}

export type BenchmarkMetricKind = "success" | "days";

export const BENCHMARK_UNAVAILABLE: OwnerBenchmark = {
  available: false,
  windowDays: 365,
  successRate: null,
  daysToSale: null,
};

const POSITIONS: readonly string[] = ["better", "same", "worse"];

function parseMetric(raw: unknown): BenchmarkMetric | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.n !== "number") return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  return {
    n: r.n,
    position: typeof r.position === "string" && POSITIONS.includes(r.position) ? (r.position as BenchmarkPosition) : null,
    self: num(r.self) ?? null,
    p25: num(r.p25),
    p50: num(r.p50),
    p75: num(r.p75),
  };
}

/** Đọc JSON của RPC; mọi hình dạng lạ ⇒ coi như không có so sánh (ẩn khối). */
export function parseBenchmark(raw: unknown): OwnerBenchmark {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return BENCHMARK_UNAVAILABLE;
  const r = raw as Record<string, unknown>;
  const successRate = parseMetric(r.success_rate);
  const daysToSale = parseMetric(r.days_to_sale);
  return {
    available: r.available === true && (successRate !== null || daysToSale !== null),
    windowDays: typeof r.window_days === "number" ? r.window_days : 365,
    successRate,
    daysToSale,
  };
}

/** Có tứ phân vị (từ 5 chi nhánh) — mới vẽ dải được. */
export function hasQuartiles(
  m: BenchmarkMetric | null,
): m is BenchmarkMetric & { p25: number; p50: number; p75: number } {
  return !!m && m.p25 !== undefined && m.p50 !== undefined && m.p75 !== undefined;
}

const COMPARE: Record<BenchmarkMetricKind, Record<BenchmarkPosition, string>> = {
  success: { better: "Cao hơn", same: "Ngang", worse: "Thấp hơn" },
  days: { better: "Nhanh hơn", same: "Ngang", worse: "Chậm hơn" },
};

const NOT_ENOUGH_SELF: Record<BenchmarkMetricKind, string> = {
  success: "Đơn vị bạn chưa đủ 3 kết quả phiên trong 12 tháng để so sánh",
  days: "Đơn vị bạn chưa đủ 3 tài sản trên sàn đã bán trong 12 tháng để so sánh",
};

/** Một câu vị trí so với trung vị, vd. "Cao hơn trung vị của 4 chi nhánh cùng hệ thống". */
export function positionSentence(m: BenchmarkMetric, kind: BenchmarkMetricKind): string {
  if (!m.position) return NOT_ENOUGH_SELF[kind];
  return `${COMPARE[kind][m.position]} trung vị của ${m.n} chi nhánh cùng hệ thống`;
}

export interface BandGeometry {
  /** % theo chiều ngang của thanh, 0–100. */
  bandLeft: number;
  bandWidth: number;
  median: number;
  self: number | null;
}

const clampPct = (v: number) => Math.min(100, Math.max(0, v));

/**
 * Vị trí dải p25–p75, vạch trung vị và chấm "đơn vị bạn" trên thanh. Tỷ lệ thành
 * công dùng thang cố định 0–100%; số ngày dùng thang 0 → 1.25 × max(p75, mình).
 */
export function bandGeometry(
  m: BenchmarkMetric & { p25: number; p50: number; p75: number },
  kind: BenchmarkMetricKind,
): BandGeometry {
  const self = m.self ?? null;
  const scaleMax = kind === "success" ? 100 : Math.max(1, Math.max(m.p75, self ?? 0) * 1.25);
  const pct = (v: number) => clampPct((v / scaleMax) * 100);
  const bandLeft = pct(m.p25);
  return {
    bandLeft,
    bandWidth: Math.max(0, pct(m.p75) - bandLeft),
    median: pct(m.p50),
    self: self === null ? null : pct(self),
  };
}
