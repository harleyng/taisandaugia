// Báo cáo kết quả đơn "Giao việc cho sàn" — trang chi tiết đơn của chủ tài sản.
//
// Thuần (không React / Supabase). Số do SERVER tính: owner_mkt_order_results (chiến dịch email /
// banner / nổi bật / link bài) + owner_mkt_order_impact (tác động lên tài sản, migration
// 20261004140000) + owner_mkt_orders.post_metrics (số bài đăng do sàn nhập). Ở đây chỉ thu hẹp
// kiểu JSON, dựng danh sách "sàn đã làm" và tính tỷ lệ / mức thay đổi để hiển thị.

// ─── Kiểu ────────────────────────────────────────────────────────────────────

export interface OrderResultsPayload {
  campaign: {
    name: string;
    status: string;
    sent_at: string | null;
    recipients: number;
    sent: number;
    opened: number;
    clicked: number;
  } | null;
  advertisement: {
    name: string;
    status: string;
    start_at: string | null;
    end_at: string | null;
    views: number;
    clicks: number;
  } | null;
  featured: { from: string | null; until: string; active: boolean } | null;
  post_url: string | null;
}

export interface PostMetrics {
  reach: number;
  engagements: number;
  clicks: number;
  updatedAt: string | null;
}

export interface ImpactCounts {
  views: number;
  visitors: number;
  saves: number;
  registrations: number;
}

export interface OrderImpact {
  window: { from: string; to: string; running: boolean };
  baseline: { from: string; to: string };
  current: ImpactCounts;
  previous: ImpactCounts;
  /** Lượt xem theo ngày (giờ VN), từ trước khoảng so sánh tới hết khoảng chạy. */
  daily: { day: string; views: number }[];
}

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

function counts(v: unknown): ImpactCounts {
  const o = (v ?? {}) as Record<string, unknown>;
  return { views: num(o.views), visitors: num(o.visitors), saves: num(o.saves), registrations: num(o.registrations) };
}

/** JSON của owner_mkt_order_impact → kiểu chặt; null khi chưa nhận việc / không có quyền. */
export function parseOrderImpact(raw: unknown): OrderImpact | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, Record<string, unknown> | unknown[]>;
  const w = (o.window ?? {}) as Record<string, unknown>;
  const b = (o.baseline ?? {}) as Record<string, unknown>;
  if (typeof w.from !== "string" || typeof w.to !== "string") return null;
  return {
    window: { from: w.from, to: w.to, running: w.running === true },
    baseline: { from: String(b.from ?? w.from), to: String(b.to ?? w.from) },
    current: counts(o.current),
    previous: counts(o.previous),
    daily: (Array.isArray(o.daily) ? o.daily : []).map((d) => {
      const r = (d ?? {}) as Record<string, unknown>;
      return { day: String(r.day ?? "").slice(0, 10), views: num(r.views) };
    }),
  };
}

/** owner_mkt_orders.post_metrics → kiểu chặt; null khi sàn chưa nhập. */
export function parsePostMetrics(raw: unknown): PostMetrics | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    reach: num(o.reach),
    engagements: num(o.engagements),
    clicks: num(o.clicks),
    updatedAt: typeof o.updated_at === "string" ? o.updated_at : null,
  };
}

// ─── Định dạng ───────────────────────────────────────────────────────────────

export const formatCount = (v: number) => v.toLocaleString("en-US");

/** "2.0%" — tỷ lệ một chữ số thập phân; "—" khi mẫu số 0. */
export function rateText(part: number, whole: number): string {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—";
}

export interface Delta {
  /** "+128%", "−20%", "Không đổi", "Mới" (trước đó 0), null = cả hai đều 0. */
  text: string | null;
  direction: "up" | "down" | "flat";
}

/** Mức thay đổi so với khoảng ngay trước khi sàn chạy. */
export function deltaOf(current: number, previous: number): Delta {
  if (current === 0 && previous === 0) return { text: null, direction: "flat" };
  if (previous === 0) return { text: "Mới", direction: "up" };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: "Không đổi", direction: "flat" };
  return pct > 0 ? { text: `+${pct}%`, direction: "up" } : { text: `−${Math.abs(pct)}%`, direction: "down" };
}

export interface ImpactMetric {
  key: keyof ImpactCounts;
  label: string;
  hint: string;
  current: number;
  previous: number;
  delta: Delta;
}

const IMPACT_META: { key: keyof ImpactCounts; label: string; hint: string }[] = [
  { key: "views", label: "Lượt xem tin", hint: "Lượt mở trang tài sản trên sàn" },
  { key: "visitors", label: "Người xem", hint: "Số phiên truy cập khác nhau" },
  { key: "saves", label: "Lượt lưu tin", hint: "Người mua lưu / theo dõi tài sản" },
  { key: "registrations", label: "Hồ sơ đăng ký", hint: "Hồ sơ tham gia đã thanh toán" },
];

export function impactMetrics(impact: OrderImpact): ImpactMetric[] {
  return IMPACT_META.map((m) => ({
    ...m,
    current: impact.current[m.key],
    previous: impact.previous[m.key],
    delta: deltaOf(impact.current[m.key], impact.previous[m.key]),
  }));
}

/** Số ngày (làm tròn lên, tối thiểu 1) của khoảng chạy — "trong 14 ngày sàn chạy". */
export function windowDays(impact: OrderImpact): number {
  const ms = new Date(impact.window.to).getTime() - new Date(impact.window.from).getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

/** Ngày (yyyy-mm-dd, giờ VN) có nằm trong khoảng chạy không — tô nền vùng sàn chạy trên biểu đồ. */
export function isInWindow(day: string, impact: OrderImpact): boolean {
  return day >= vnDay(impact.window.from) && day <= vnDay(impact.window.to);
}

export function vnDay(iso: string): string {
  return new Date(new Date(iso).getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

// ─── Sàn đã làm gì ───────────────────────────────────────────────────────────

export type DeliverableKind = "banner" | "email" | "featured" | "post";

export interface DeliverableFigure {
  label: string;
  value: string;
  hint?: string;
}

export interface Deliverable {
  kind: DeliverableKind;
  title: string;
  /** Tên chiến dịch / banner, hoặc mô tả ngắn. */
  detail: string | null;
  state: "running" | "done" | "pending";
  from: string | null;
  to: string | null;
  figures: DeliverableFigure[];
  url: string | null;
  /** Câu thay cho số liệu khi chưa có. */
  emptyText: string | null;
}

const DAY_MS = 86_400_000;

/** "Đã chạy đủ 7 ngày" / "Còn 3 ngày" — thay cho số liệu ở dòng tin nổi bật. */
function featuredNote(f: NonNullable<OrderResultsPayload["featured"]>, now: number): string | null {
  const until = new Date(f.until).getTime();
  if (f.active) return `Còn ${Math.max(1, Math.ceil((until - now) / DAY_MS))} ngày`;
  if (!f.from) return null;
  return `Đã chạy đủ ${Math.max(1, Math.round((until - new Date(f.from).getTime()) / DAY_MS))} ngày`;
}

/** Hạng mục mỗi gói hứa làm — dùng để hiện "đang chuẩn bị" khi sàn chưa gắn gì. */
const EXPECTED: Record<string, DeliverableKind[]> = {
  mkt_featured_owner: ["featured"],
  mkt_social_owner: ["post"],
  mkt_banner_owner: ["banner"],
  mkt_full_owner: ["banner"],
};

const TITLES: Record<DeliverableKind, string> = {
  banner: "Banner trên sàn",
  email: "Email tới người mua phù hợp",
  featured: "Tin nổi bật",
  post: "Bài đăng fanpage của sàn",
};

interface DeliverableOrder {
  variant_key: string;
  status: string;
  post_url: string | null;
  post_metrics: unknown;
  completed_at: string | null;
}

/**
 * Danh sách hạng mục sàn đã thực hiện cho đơn, theo thứ tự banner · email · nổi bật · bài đăng.
 * Hạng mục gói hứa mà chưa có ⇒ dòng "pending" để chủ tài sản thấy sàn còn đang chuẩn bị.
 */
export function buildDeliverables(
  order: DeliverableOrder,
  results: OrderResultsPayload | null,
  now = Date.now(),
): Deliverable[] {
  const out: Deliverable[] = [];
  const done = order.status === "completed";
  const a = results?.advertisement;
  const c = results?.campaign;
  const f = results?.featured;
  const url = results?.post_url ?? order.post_url;
  const pm = parsePostMetrics(order.post_metrics);

  if (a) {
    const ended = a.status === "ended" || (!!a.end_at && new Date(a.end_at).getTime() < now) || done;
    out.push({
      kind: "banner",
      title: TITLES.banner,
      detail: a.name,
      state: ended ? "done" : "running",
      from: a.start_at,
      to: a.end_at,
      figures: [
        { label: "Hiển thị", value: formatCount(a.views) },
        { label: "Lượt bấm", value: formatCount(a.clicks), hint: rateText(a.clicks, a.views) },
      ],
      url: null,
      emptyText: null,
    });
  }

  if (c) {
    out.push({
      kind: "email",
      title: TITLES.email,
      detail: c.name,
      state: c.sent_at ? "done" : "running",
      from: c.sent_at,
      to: null,
      figures: [
        { label: "Đã gửi", value: formatCount(c.sent) },
        { label: "Đã mở", value: formatCount(c.opened), hint: rateText(c.opened, c.sent) },
        { label: "Đã bấm", value: formatCount(c.clicked), hint: rateText(c.clicked, c.sent) },
      ],
      url: null,
      emptyText: c.sent_at ? null : "Chiến dịch đã soạn, chưa gửi.",
    });
  }

  if (f) {
    out.push({
      kind: "featured",
      title: TITLES.featured,
      detail: "Đầu danh sách & trang chủ",
      state: f.active ? "running" : "done",
      from: f.from,
      to: f.until,
      figures: [],
      url: null,
      emptyText: featuredNote(f, now),
    });
  }

  if (url || pm) {
    out.push({
      kind: "post",
      title: TITLES.post,
      detail: null,
      state: "done",
      from: null,
      to: null,
      figures: pm
        ? [
            { label: "Tiếp cận", value: formatCount(pm.reach) },
            { label: "Tương tác", value: formatCount(pm.engagements), hint: rateText(pm.engagements, pm.reach) },
            { label: "Lượt bấm về tin", value: formatCount(pm.clicks), hint: rateText(pm.clicks, pm.reach) },
          ]
        : [],
      url,
      emptyText: pm ? null : "Sàn sẽ cập nhật số tiếp cận và tương tác của bài đăng.",
    });
  }

  if (!done) {
    for (const kind of EXPECTED[order.variant_key] ?? []) {
      if (out.some((d) => d.kind === kind)) continue;
      out.push({
        kind,
        title: TITLES[kind],
        detail: null,
        state: "pending",
        from: null,
        to: null,
        figures: [],
        url: null,
        emptyText: kind === "post" ? "Sàn đang biên tập bài đăng." : "Sàn đang chuẩn bị — số liệu hiện khi bắt đầu chạy.",
      });
    }
  }
  return out;
}

// ─── Biểu đồ lượt xem theo ngày ──────────────────────────────────────────────

/** Đỉnh trục tung "đẹp" ≥ max và chia đôi ra số nguyên (trục có 3 vạch: đỉnh · nửa · 0). */
export function chartCeiling(max: number): number {
  if (max <= 0) return 2;
  const mag = 10 ** Math.floor(Math.log10(max));
  for (const c of [1, 2, 4, 5, 6, 8, 10]) {
    const v = c * mag;
    if (v >= max && Number.isInteger(v / 2)) return v;
  }
  return 20 * mag;
}

/** Chỉ số các ngày ghi nhãn trục hoành — tối đa `count` mốc trải đều, luôn có ngày đầu và cuối. */
export function axisTickIndexes(length: number, count = 5): number[] {
  if (length <= 0) return [];
  if (length <= count) return Array.from({ length }, (_, i) => i);
  return Array.from({ length: count }, (_, i) => Math.round((i * (length - 1)) / (count - 1)));
}
