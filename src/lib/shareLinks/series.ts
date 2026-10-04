// Số liệu theo ngày của link Hồ sơ online (RPC owner_share_link_series / owner_mkt_campaign_series,
// migration 20261004210000). Thuần — test ở series.test.ts.
//
// Server dựng sẵn mọi ngày trong khoảng (kể cả ngày trống, giờ VN); khoảng > 120 ngày gom theo
// tuần. Tổng kỳ đếm người KHÁC NHAU trên cả kỳ — không cộng các ngày lại.

// ─── Bộ lọc ──────────────────────────────────────────────────────────────────

export const SHARE_PERIODS = [
  { value: "7", label: "7 ngày qua", days: 7 },
  { value: "30", label: "30 ngày qua", days: 30 },
  { value: "90", label: "90 ngày qua", days: 90 },
  { value: "all", label: "Từ khi tạo link", days: null as number | null },
] as const;
export type SharePeriod = (typeof SHARE_PERIODS)[number]["value"];
export const DEFAULT_SHARE_PERIOD: SharePeriod = "30";

export const SHARE_DEVICES = [
  { value: "all", label: "Tất cả thiết bị" },
  { value: "mobile", label: "Điện thoại" },
  { value: "desktop", label: "Máy tính" },
  { value: "tablet", label: "Máy tính bảng" },
] as const;
export type ShareDeviceFilter = (typeof SHARE_DEVICES)[number]["value"];

const VN_ISO_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });

/** "2026-10-04" theo giờ Việt Nam. */
export const vnIsoDay = (d: Date = new Date()) => VN_ISO_DAY.format(d);

function addDays(isoDay: string, n: number): string {
  const t = Date.parse(`${isoDay}T00:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Khoảng ngày gửi RPC. "Từ khi tạo" ⇒ from = null (server lấy ngày tạo link / duyệt chiến dịch). */
export function periodRange(period: SharePeriod, now: Date = new Date()): { from: string | null; to: string } {
  const to = vnIsoDay(now);
  const days = SHARE_PERIODS.find((p) => p.value === period)?.days ?? null;
  return { from: days ? addDays(to, -(days - 1)) : null, to };
}

export const deviceParam = (d: ShareDeviceFilter): string | null => (d === "all" ? null : d);

// ─── Chuỗi ───────────────────────────────────────────────────────────────────

export interface ShareCounts {
  views: number;
  viewers: number;
  dossier: number;
  /** Số người khác nhau bấm "Mua hồ sơ". */
  dossierPeople: number;
  pdf: number;
  follow: number;
  call: number;
}

export interface SharePoint extends ShareCounts {
  date: string;
  /** Người bấm "Mua hồ sơ" / người xem trong ngày; null khi chưa ai xem. */
  conversion: number | null;
}

export interface ShareSeries {
  unit: "day" | "week";
  from: string;
  to: string;
  points: SharePoint[];
  totals: ShareCounts & { conversion: number | null };
}

/**
 * Tỷ lệ chuyển đổi = người bấm "Mua hồ sơ" / người xem. Cùng một người có thể bấm ở ngày khác
 * ngày xem ⇒ chặn trần 100%.
 */
export function conversionRate(people: number, viewers: number): number | null {
  if (viewers <= 0) return null;
  return Math.min(1, people / viewers);
}

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const int = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function mapCounts(r: Raw): ShareCounts {
  return {
    views: int(r.views),
    viewers: int(r.viewers),
    dossier: int(r.dossier),
    dossierPeople: int(r.dossier_people),
    pdf: int(r.pdf),
    follow: int(r.follow),
    call: int(r.call),
  };
}

export function mapShareSeries(v: unknown): ShareSeries {
  const d = obj(v);
  const totals = mapCounts(obj(d.totals));
  return {
    unit: d.unit === "week" ? "week" : "day",
    from: typeof d.from === "string" ? d.from : "",
    to: typeof d.to === "string" ? d.to : "",
    points: (Array.isArray(d.series) ? d.series : []).map((x) => {
      const r = obj(x);
      const c = mapCounts(r);
      return { date: typeof r.date === "string" ? r.date : "", ...c, conversion: conversionRate(c.dossierPeople, c.viewers) };
    }),
    totals: { ...totals, conversion: conversionRate(totals.dossierPeople, totals.viewers) },
  };
}

// ─── Hiển thị ────────────────────────────────────────────────────────────────

export const formatCount = (n: number) => n.toLocaleString("en-US");

/** 0.0984 → "9.84%"; null → "—". */
export function formatRate(v: number | null): string {
  if (v === null) return "—";
  return `${(v * 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

/** "2026-10-04" → "04/10"; tuần → "Tuần 28/09". */
export function pointLabel(date: string, unit: ShareSeries["unit"]): string {
  const [, m, d] = date.split("-");
  if (!m || !d) return date;
  return unit === "week" ? `Tuần ${d}/${m}` : `${d}/${m}`;
}

/** "Ngày 04/10/2026" / "Tuần từ 28/09/2026" — tiêu đề tooltip. */
export function pointTitle(date: string, unit: ShareSeries["unit"]): string {
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return unit === "week" ? `Tuần từ ${d}/${m}/${y}` : `Ngày ${d}/${m}/${y}`;
}
