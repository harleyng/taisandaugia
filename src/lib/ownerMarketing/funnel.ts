// Phễu truyền thông của Trạm Điều Hành (docs/owner-marketing-plan.md Phase M5, §B5).
//
// Thuần (không React / Supabase) để test được. Mọi số do SERVER tính ở
// owner_mkt_funnel_core (migration 20261002150000) — tab "Hiệu quả", bộ lọc một tài sản và
// phần "Hiệu quả truyền thông" của báo cáo định kỳ dùng chung hàm đó ⇒ cùng kỳ thì cùng số.
// Module này chỉ thu hẹp kiểu JSON và đặt nhãn, không tính lại số nào ngoài tỷ lệ hiển thị.
//
// Luật ghi nhận nguồn: lần chạm cuối trong 30 ngày (cookie của link /l/:code). Lượt lưu /
// đăng ký không mang link — kể cả đăng ký ngoài sàn — là "Không xác định nguồn".

import { RESOLVED_OUTCOME_KINDS, type ResolvedOutcomeKind } from "@/lib/ownerOutcomes";
import { periodEndOf, periodStartOf, shiftPeriod } from "@/lib/ownerTargets";
import { channelLabel } from "./links";
import { packageLabel } from "./orders";

// ─── Kiểu ────────────────────────────────────────────────────────────────────

/** Bộ số đếm chung của một dòng (kênh / nguồn / tài sản / tổng). */
export interface FunnelCounts {
  sent: number;
  opened: number;
  clicks: number;
  visitors: number;
  saves: number;
  registrations: number;
}

export interface FunnelTotals extends FunnelCounts {
  /** Số tài sản đang truyền thông (có link hoặc đơn sàn làm). */
  assets: number;
  links: number;
  orders: number;
  participants: number;
  /** Số tài sản có kết quả phiên trong kỳ. */
  outcomes: number;
  sold: number;
  soldValue: number;
  /** Tổng giá trúng / giá khởi điểm chỉ trên tài sản có đủ cả hai giá. */
  pricedSoldValue: number;
  pricedStartingValue: number;
}

/** "link" = kênh riêng của đơn vị (link theo dõi); "platform" = gói "Giao việc cho sàn". */
export type FunnelChannelKind = "link" | "platform";

export interface FunnelChannelRow extends FunnelCounts {
  kind: FunnelChannelKind;
  /** Mã kênh (zalo, sms…) hoặc mã gói (mkt_featured_owner…). */
  key: string;
  /** Số link (kênh riêng) hoặc số đơn (gói sàn). */
  items: number;
}

export const FUNNEL_SOURCES = ["self_serve", "platform", "own_links"] as const;
export type FunnelSource = (typeof FUNNEL_SOURCES)[number];

export interface FunnelSourceRow extends FunnelCounts {
  key: FunnelSource;
  items: number;
}

export interface FunnelAssetRow extends FunnelCounts {
  /**
   * id tin trên sàn hoặc hồ sơ số hoá (từ 20261004210200 phễu gồm cả hồ sơ có link Hồ sơ online).
   * Không có ở báo cáo đã chia sẻ (khoá *_id bị lọc khỏi /r/:token).
   */
  assetId: string | null;
  /** "posting" = hồ sơ số hoá; dữ liệu cũ / báo cáo chia sẻ không có ⇒ "listing". */
  kind: "listing" | "posting";
  assetCode: string | null;
  title: string;
  branchName: string | null;
  links: number;
  orders: number;
  savesUnattributed: number;
  registrationsUnattributed: number;
  participants: number | null;
  outcome: ResolvedOutcomeKind | null;
  outcomeDate: string | null;
  price: number | null;
  startingPrice: number | null;
}

export interface MarketingFunnel {
  period: { from: string; to: string };
  attributionDays: number;
  totals: FunnelTotals;
  unattributed: { saves: number; registrations: number };
  byChannel: FunnelChannelRow[];
  bySource: FunnelSourceRow[];
  byAsset: FunnelAssetRow[];
}

// ─── Thu hẹp kiểu ────────────────────────────────────────────────────────────

type Obj = Record<string, unknown>;

const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
const num0 = (v: unknown) => num(v) ?? 0;

function counts(o: Obj): FunnelCounts {
  return {
    sent: num0(o.sent),
    opened: num0(o.opened),
    clicks: num0(o.clicks),
    visitors: num0(o.visitors),
    saves: num0(o.saves),
    registrations: num0(o.registrations),
  };
}

const outcomeKind = (v: unknown): ResolvedOutcomeKind | null =>
  typeof v === "string" && (RESOLVED_OUTCOME_KINDS as readonly string[]).includes(v) ? (v as ResolvedOutcomeKind) : null;

/** JSON của owner_mkt_funnel / phần `marketing` của báo cáo ⇒ dạng an toàn; null khi không đọc được kỳ. */
export function mapMarketingFunnel(raw: unknown): MarketingFunnel | null {
  const p = obj(raw);
  const period = obj(p.period);
  const from = str(period.from);
  const to = str(period.to);
  if (!from || !to) return null;
  const t = obj(p.totals);
  const u = obj(p.unattributed);
  return {
    period: { from, to },
    attributionDays: num(p.attribution_days) ?? 30,
    totals: {
      ...counts(t),
      assets: num0(t.assets),
      links: num0(t.links),
      orders: num0(t.orders),
      participants: num0(t.participants),
      outcomes: num0(t.outcomes),
      sold: num0(t.sold),
      soldValue: num0(t.sold_value),
      pricedSoldValue: num0(t.priced_sold_value),
      pricedStartingValue: num0(t.priced_starting_value),
    },
    unattributed: { saves: num0(u.saves), registrations: num0(u.registrations) },
    byChannel: arr(p.by_channel).flatMap((raw) => {
      const r = obj(raw);
      const key = str(r.key);
      if (!key) return [];
      return [{ ...counts(r), kind: r.kind === "platform" ? "platform" : "link", key, items: num0(r.items) }];
    }),
    bySource: arr(p.by_source).flatMap((raw) => {
      const r = obj(raw);
      const key = (FUNNEL_SOURCES as readonly string[]).includes(r.key as string) ? (r.key as FunnelSource) : null;
      return key ? [{ ...counts(r), key, items: num0(r.items) }] : [];
    }),
    byAsset: arr(p.by_asset).map((raw) => {
      const r = obj(raw);
      return {
        ...counts(r),
        assetId: str(r.asset_id) ?? str(r.listing_id) ?? str(r.posting_id),
        kind: r.kind === "posting" ? ("posting" as const) : ("listing" as const),
        assetCode: str(r.asset_code),
        title: str(r.title) ?? "Tài sản chưa đặt tên",
        branchName: str(r.branch_name),
        links: num0(r.links),
        orders: num0(r.orders),
        savesUnattributed: num0(r.saves_unattributed),
        registrationsUnattributed: num0(r.registrations_unattributed),
        participants: num(r.participants),
        outcome: outcomeKind(r.outcome),
        outcomeDate: str(r.outcome_date),
        price: num(r.price),
        startingPrice: num(r.starting_price),
      };
    }),
  };
}

// ─── Phễu (§B5) ──────────────────────────────────────────────────────────────

export type FunnelStageKey =
  | "sent"
  | "opened"
  | "clicks"
  | "visitors"
  | "saves"
  | "registrations"
  | "participants"
  | "sold";

export interface FunnelStage {
  key: FunnelStageKey;
  label: string;
  value: number;
  /** Một câu giải thích nguồn số — tooltip / chú thích. */
  hint: string;
}

/** Gửi → Mở → Bấm → Xem tài sản → Lưu → Đăng ký → Người tham gia → Kết quả. */
export function funnelStages(t: FunnelTotals): FunnelStage[] {
  return [
    { key: "sent", label: "Gửi", value: t.sent, hint: "Email sàn gửi và lượt hiển thị banner của gói “Giao việc cho sàn”. Kênh riêng của đơn vị không đếm được số người nhận." },
    { key: "opened", label: "Mở", value: t.opened, hint: "Email của sàn được mở." },
    { key: "clicks", label: "Bấm", value: t.clicks, hint: "Lượt mở link theo dõi, cộng lượt bấm email / banner của sàn." },
    { key: "visitors", label: "Xem tài sản", value: t.visitors, hint: "Số người mở link (trình duyệt khác nhau, theo từng link), cộng lượt bấm email / banner của sàn." },
    { key: "saves", label: "Lưu", value: t.saves, hint: "Người mua lưu tài sản sau khi tới từ link theo dõi (≤ 30 ngày)." },
    { key: "registrations", label: "Đăng ký tham gia", value: t.registrations, hint: "Hồ sơ tham gia đã thanh toán trên sàn, tới từ link theo dõi (≤ 30 ngày)." },
    { key: "participants", label: "Người tham gia phiên", value: t.participants, hint: "Người tham gia các phiên có kết quả trong kỳ của tài sản đang truyền thông — mọi nguồn." },
    { key: "sold", label: "Kết quả", value: t.sold, hint: "Tài sản đang truyền thông đấu giá thành trong kỳ." },
  ];
}

/** Giá trúng / giá khởi điểm (%) — null khi không có tài sản nào đủ cả hai giá. */
export function priceRatioPct(t: Pick<FunnelTotals, "pricedSoldValue" | "pricedStartingValue">): number | null {
  if (t.pricedStartingValue <= 0 || t.pricedSoldValue <= 0) return null;
  return Math.round((t.pricedSoldValue / t.pricedStartingValue) * 100);
}

/** Giá trúng / giá khởi điểm (%) của một tài sản đã bán; null khi thiếu giá. */
export function assetPriceRatioPct(a: Pick<FunnelAssetRow, "outcome" | "price" | "startingPrice">): number | null {
  if (a.outcome !== "sold" || !a.price || !a.startingPrice || a.startingPrice <= 0) return null;
  return Math.round((a.price / a.startingPrice) * 100);
}

/** Bề rộng thanh (%) so với giai đoạn lớn nhất; giai đoạn > 0 luôn thấy được (≥ 2%). */
export function stageBarPct(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(2, Math.round((value / max) * 100));
}

/** Kỳ không có hoạt động nào để vẽ phễu. */
export function isFunnelEmpty(f: Pick<MarketingFunnel, "totals" | "unattributed">): boolean {
  const t = f.totals;
  return (
    t.assets === 0 ||
    (t.sent + t.clicks + t.saves + t.registrations + t.participants + t.sold === 0 &&
      f.unattributed.saves + f.unattributed.registrations === 0)
  );
}

// ─── Nhãn ────────────────────────────────────────────────────────────────────

export const FUNNEL_SOURCE_LABEL: Record<FunnelSource, string> = {
  self_serve: "Chiến dịch tự truyền thông",
  platform: "Giao việc cho sàn",
  own_links: "Link lẻ của đơn vị",
};

export const UNATTRIBUTED_LABEL = "Không xác định nguồn";

export const UNATTRIBUTED_HINT =
  "Lượt lưu / đăng ký của tài sản đang truyền thông nhưng không đi qua link theo dõi (khách tự tìm, đăng ký ngoài sàn…). Sàn không gắn được những lượt này cho kênh nào.";

export function funnelChannelLabel(row: Pick<FunnelChannelRow, "kind" | "key">): string {
  return row.kind === "platform" ? `Sàn · ${packageLabel(row.key)}` : channelLabel(row.key);
}

// ─── Kỳ ──────────────────────────────────────────────────────────────────────

export const FUNNEL_PERIODS = ["30-ngay", "thang-nay", "thang-truoc", "quy-nay", "nam-nay"] as const;
export type FunnelPeriod = (typeof FUNNEL_PERIODS)[number];

export const FUNNEL_PERIOD_LABEL: Record<FunnelPeriod, string> = {
  "30-ngay": "30 ngày qua",
  "thang-nay": "Tháng này",
  "thang-truoc": "Tháng trước",
  "quy-nay": "Quý này",
  "nam-nay": "Năm nay",
};

export const DEFAULT_FUNNEL_PERIOD: FunnelPeriod = "30-ngay";

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Khoảng ngày (bao gồm hai đầu) của một lựa chọn kỳ. Tháng / quý / năm theo lịch — khớp báo cáo định kỳ. */
export function resolveFunnelPeriod(period: FunnelPeriod, today: string): { from: string; to: string } {
  switch (period) {
    case "thang-nay": {
      const from = periodStartOf("month", today);
      return { from, to: periodEndOf("month", from) };
    }
    case "thang-truoc": {
      const from = shiftPeriod("month", periodStartOf("month", today), -1);
      return { from, to: periodEndOf("month", from) };
    }
    case "quy-nay": {
      const from = periodStartOf("quarter", today);
      return { from, to: periodEndOf("quarter", from) };
    }
    case "nam-nay": {
      const from = periodStartOf("year", today);
      return { from, to: periodEndOf("year", from) };
    }
    default:
      return { from: addDays(today, -29), to: today };
  }
}

// ─── Lỗi ─────────────────────────────────────────────────────────────────────

export const FUNNEL_REASON_MESSAGES: Record<string, string> = {
  forbidden: "Bạn không có quyền xem hiệu quả truyền thông của đơn vị này.",
  invalid_period: "Kỳ xem không hợp lệ (tối đa 1 năm).",
};
