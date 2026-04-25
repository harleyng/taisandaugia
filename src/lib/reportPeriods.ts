// Helpers cho định danh & quản lý kỳ báo cáo (Tháng / Quý / Năm).
// Period ID format:
//   m-YYYY-MM   (Tháng, MM = 01..12)
//   q-YYYY-N    (Quý, N = 1..4)
//   y-YYYY      (Năm)

export type PeriodKind = "month" | "quarter" | "year";

export interface ParsedPeriod {
  kind: PeriodKind;
  year: number;
  month?: number; // 1..12
  quarter?: number; // 1..4
}

const pad2 = (n: number) => n.toString().padStart(2, "0");

export const monthId = (year: number, month: number) => `m-${year}-${pad2(month)}`;
export const quarterId = (year: number, quarter: number) => `q-${year}-${quarter}`;
export const yearId = (year: number) => `y-${year}`;

export const parsePeriod = (id: string): ParsedPeriod | null => {
  if (!id) return null;
  const parts = id.split("-");
  if (parts[0] === "m" && parts.length === 3) {
    const year = Number(parts[1]);
    const month = Number(parts[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
    return { kind: "month", year, month };
  }
  if (parts[0] === "q" && parts.length === 3) {
    const year = Number(parts[1]);
    const quarter = Number(parts[2]);
    if (!Number.isFinite(year) || !Number.isFinite(quarter)) return null;
    return { kind: "quarter", year, quarter };
  }
  if (parts[0] === "y" && parts.length === 2) {
    const year = Number(parts[1]);
    if (!Number.isFinite(year)) return null;
    return { kind: "year", year };
  }
  return null;
};

export const periodKind = (id: string): PeriodKind | null => parsePeriod(id)?.kind ?? null;

export const getMonthsInQuarter = (year: number, quarter: number): string[] => {
  const startMonth = (quarter - 1) * 3 + 1;
  return [0, 1, 2].map((i) => monthId(year, startMonth + i));
};

export const getQuartersInYear = (year: number): string[] =>
  [1, 2, 3, 4].map((q) => quarterId(year, q));

export const getMonthsInYear = (year: number): string[] =>
  Array.from({ length: 12 }, (_, i) => monthId(year, i + 1));

/**
 * Khi mua 1 kỳ → trả về tất cả periodId được mở (gồm chính nó).
 *  - Tháng: chỉ chính nó.
 *  - Quý  : Quý + 3 tháng bên trong.
 *  - Năm  : Năm + 4 quý + 12 tháng bên trong.
 */
export const expandUnlock = (id: string): string[] => {
  const p = parsePeriod(id);
  if (!p) return [id];
  if (p.kind === "month") return [id];
  if (p.kind === "quarter") {
    return [id, ...getMonthsInQuarter(p.year, p.quarter!)];
  }
  // year
  const quarters = getQuartersInYear(p.year);
  const months = getMonthsInYear(p.year);
  return [id, ...quarters, ...months];
};

const MONTH_LABELS = [
  "01", "02", "03", "04", "05", "06",
  "07", "08", "09", "10", "11", "12",
];

export const formatPeriodLabel = (id: string): string => {
  const p = parsePeriod(id);
  if (!p) return id;
  if (p.kind === "month") return `Tháng ${MONTH_LABELS[(p.month ?? 1) - 1]}/${p.year}`;
  if (p.kind === "quarter") return `Quý ${p.quarter}/${p.year}`;
  return `Năm ${p.year}`;
};

export const formatPeriodKindLabel = (kind: PeriodKind): string =>
  kind === "month" ? "Tháng" : kind === "quarter" ? "Quý" : "Năm";

/**
 * Sinh danh sách kỳ khả dụng (cố định, dùng tham chiếu thời gian là 30/09/2025
 * — khớp với updatedAt của các báo cáo mock hiện có).
 *  - Tháng: 12 tháng gần nhất tính đến tham chiếu (mới nhất đứng đầu).
 *  - Quý: 6 quý gần nhất.
 *  - Năm: 2 năm gần nhất.
 */
const REFERENCE = { year: 2025, month: 9 } as const;

export interface AvailablePeriods {
  months: string[];
  quarters: string[];
  years: string[];
}

export const getAvailablePeriods = (): AvailablePeriods => {
  const months: string[] = [];
  let y = REFERENCE.year;
  let m = REFERENCE.month;
  for (let i = 0; i < 12; i++) {
    months.push(monthId(y, m));
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }

  const quarters: string[] = [];
  const refQuarter = Math.ceil(REFERENCE.month / 3);
  let qy = REFERENCE.year;
  let qq = refQuarter;
  for (let i = 0; i < 6; i++) {
    quarters.push(quarterId(qy, qq));
    qq -= 1;
    if (qq === 0) {
      qq = 4;
      qy -= 1;
    }
  }

  const years: string[] = [yearId(REFERENCE.year), yearId(REFERENCE.year - 1)];

  return { months, quarters, years };
};

export const latestPeriodId = (kind: PeriodKind): string => {
  const all = getAvailablePeriods();
  if (kind === "month") return all.months[0];
  if (kind === "quarter") return all.quarters[0];
  return all.years[0];
};
