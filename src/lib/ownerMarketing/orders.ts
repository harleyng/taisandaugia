// "Giao việc cho sàn" — đơn truyền thông chủ tài sản đặt sàn làm (docs/owner-marketing-plan.md
// Phase M4, migration 20261002110000_owner_mkt_orders).
//
// Thuần (không React / Supabase) để test được. Luật ở server:
//   • Gói giá cố định (credit): đặt là TRẢ LUÔN — hạn mức gói dịch vụ trước, hết thì credit.
//     "Tin nổi bật 7 ngày" dùng quyền lợi "Tin đăng ưu tiên" (priority_listing).
//   • Gói báo giá (VND): requested → admin báo giá → quoted → VNPay → paid.
//   • paid → admin nhận việc (in_progress) → hoàn tất (completed). Huỷ: chủ tự huỷ khi chưa trả;
//     admin huỷ được tới khi đã trả (hoàn lượt / credit tự động).
//   • Đặt / huỷ / trả cần truyen-thong:share trong phạm vi chi nhánh của tài sản.

import { addBusinessDays } from "date-fns";
import { BadgeCheck, Image as ImageIcon, Rocket, Share2, type LucideIcon } from "lucide-react";
import { ownerMarketingOrderHref } from "./routes";

// ─── Gói ─────────────────────────────────────────────────────────────────────

/** Bản sao owner_mkt_order_variant_keys(). mkt_email_owner đang HOÃN — không bán. */
export const MKT_ORDER_PACKAGES = [
  "mkt_featured_owner",
  "mkt_social_owner",
  "mkt_banner_owner",
  "mkt_full_owner",
] as const;
export type MktOrderPackage = (typeof MKT_ORDER_PACKAGES)[number];

export type MktOrderPricing = "credits" | "quote";

/** Bản sao owner_mkt_featured_days(). */
export const FEATURED_DAYS = 7;

/** Bản sao owner_mkt_order_benefit_key(): quyền lợi gói dịch vụ trả thay credit. */
export const MKT_ORDER_BENEFIT: Partial<Record<MktOrderPackage, "priority_listing">> = {
  mkt_featured_owner: "priority_listing",
};

export interface MktPackageMeta {
  label: string;
  icon: LucideIcon;
  pricing: MktOrderPricing;
  /** Một câu: bạn nhận được gì. */
  summary: string;
  /** 2–3 gạch đầu dòng trên thẻ gói. */
  includes: readonly string[];
}

export const MKT_PACKAGE_META: Record<MktOrderPackage, MktPackageMeta> = {
  mkt_featured_owner: {
    label: "Tin nổi bật 7 ngày",
    icon: Rocket,
    pricing: "credits",
    summary: "Đưa tài sản lên đầu danh sách tài sản đấu giá và trang chủ trong 7 ngày.",
    includes: ["Nhãn “Nổi bật” trên thẻ tài sản", "Ưu tiên ở trang chủ và trang tìm kiếm", "Bắt đầu khi sàn nhận việc"],
  },
  mkt_social_owner: {
    label: "Đăng trên kênh mạng xã hội của sàn",
    icon: Share2,
    pricing: "credits",
    summary: "Sàn biên tập và đăng một bài giới thiệu tài sản trên fanpage của sàn.",
    includes: ["Bài viết do sàn biên tập", "Đăng trên fanpage của sàn", "Gửi lại link bài đăng khi xong"],
  },
  mkt_banner_owner: {
    label: "Banner trên sàn",
    icon: ImageIcon,
    pricing: "quote",
    summary: "Banner quảng bá tài sản ở vị trí nổi bật trên sàn, theo vị trí và thời gian bạn cần.",
    includes: ["Sàn thiết kế banner theo hồ sơ", "Chọn vị trí và thời gian hiển thị", "Báo số lượt xem, lượt bấm"],
  },
  mkt_full_owner: {
    label: "Gói trọn chiến dịch",
    icon: BadgeCheck,
    pricing: "quote",
    summary: "Sàn lên kế hoạch và chạy truyền thông đa kênh, báo cáo kết quả cuối đợt.",
    includes: ["Kế hoạch theo mục tiêu của bạn", "Phối hợp nhiều kênh của sàn", "Báo cáo kết quả cuối đợt"],
  },
};

/** Gói hiện trong hộp "Chọn gói" của chủ tài sản. Bài đăng mạng xã hội KHÔNG chào nữa (04/10);
 *  server vẫn nhận gói này ⇒ đơn cũ vẫn hiện và admin vẫn hoàn tất được. */
export const MKT_PICKABLE_PACKAGES: readonly MktOrderPackage[] = MKT_ORDER_PACKAGES.filter(
  (k) => k !== "mkt_social_owner",
);

export function isMktOrderPackage(v: unknown): v is MktOrderPackage {
  return typeof v === "string" && (MKT_ORDER_PACKAGES as readonly string[]).includes(v);
}

export const packageLabel = (key: string): string =>
  isMktOrderPackage(key) ? MKT_PACKAGE_META[key].label : "Gói truyền thông";

// ─── Mục tiêu ────────────────────────────────────────────────────────────────

export const MKT_ORDER_GOALS = ["registrations", "awareness", "price_discovery", "other"] as const;
export type MktOrderGoal = (typeof MKT_ORDER_GOALS)[number];

export const MKT_GOAL_LABELS: Record<MktOrderGoal, string> = {
  registrations: "Thêm người đăng ký tham gia",
  awareness: "Nhiều người biết tới tài sản",
  price_discovery: "Thăm dò mức giá thị trường",
  other: "Khác",
};

export const goalLabel = (g: string): string => MKT_GOAL_LABELS[g as MktOrderGoal] ?? "Khác";

export const BRIEF_MAX = 2000;

// ─── Trạng thái ──────────────────────────────────────────────────────────────

export type MktOrderStatus = "requested" | "quoted" | "paid" | "in_progress" | "completed" | "cancelled";

export const MKT_ORDER_STATUS_LABELS: Record<MktOrderStatus, string> = {
  requested: "Chờ báo giá",
  quoted: "Chờ thanh toán",
  paid: "Chờ sàn nhận việc",
  in_progress: "Sàn đang thực hiện",
  completed: "Hoàn tất",
  cancelled: "Đã huỷ",
};

export const statusLabel = (s: string): string => MKT_ORDER_STATUS_LABELS[s as MktOrderStatus] ?? s;

export type MktOrderTone = "primary" | "success" | "warning" | "muted";

export const MKT_ORDER_STATUS_TONE: Record<MktOrderStatus, MktOrderTone> = {
  requested: "muted",
  quoted: "warning",
  paid: "primary",
  in_progress: "primary",
  completed: "success",
  cancelled: "muted",
};

export const MKT_TONE_BADGE: Record<MktOrderTone, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  muted: "bg-muted text-muted-foreground",
};

export const OPEN_STATUSES: readonly MktOrderStatus[] = ["requested", "quoted", "paid", "in_progress"];

/** Dòng đơn tối thiểu mà các hàm dưới cần (khớp cột owner_mkt_orders). */
export interface MktOrderLike {
  status: string;
  pricing: string;
  quote_expires_at: string | null;
}

export function isQuoteExpired(o: MktOrderLike, now = Date.now()): boolean {
  return o.status === "quoted" && !!o.quote_expires_at && new Date(o.quote_expires_at).getTime() < now;
}

/** Việc tiếp theo — nhìn từ phía chủ tài sản. */
export function ownerNextStep(o: MktOrderLike, now = Date.now()): string {
  switch (o.status) {
    case "requested":
      return "Sàn đang chuẩn bị báo giá cho yêu cầu của bạn.";
    case "quoted":
      return isQuoteExpired(o, now)
        ? "Báo giá đã hết hạn — sàn sẽ báo giá lại, hoặc huỷ yêu cầu nếu không cần nữa."
        : "Xem báo giá và thanh toán để sàn bắt đầu.";
    case "paid":
      return "Đã thanh toán. Sàn sẽ nhận việc và bắt đầu thực hiện.";
    case "in_progress":
      return "Sàn đang thực hiện — kết quả bên dưới cập nhật theo thời gian chạy.";
    case "completed":
      return "Đã xong. Xem kết quả bên dưới.";
    default:
      return "Đơn đã huỷ.";
  }
}

/** Câu dưới tiêu đề hero trang chi tiết đơn — tình trạng đơn, nhìn từ phía chủ tài sản. */
export function ownerOrderHeadline(o: MktOrderLike & { paid_at: string | null }, now = Date.now()): string {
  switch (o.status) {
    case "requested":
      return "Sàn đang xem yêu cầu và sẽ gửi báo giá trong 1 ngày làm việc.";
    case "quoted":
      return isQuoteExpired(o, now)
        ? "Báo giá đã hết hạn. Sàn sẽ báo giá lại, hoặc huỷ yêu cầu nếu không cần nữa."
        : "Sàn đã báo giá. Thanh toán để sàn bắt đầu thực hiện.";
    case "paid":
      return "Đã nhận thanh toán. Sàn sẽ nhận việc và lên lịch chạy.";
    case "in_progress":
      return "Sàn đang chạy truyền thông. Số liệu cập nhật hằng ngày.";
    case "completed":
      return "Đợt truyền thông đã kết thúc. Xem tổng kết của sàn bên dưới.";
    default:
      return o.paid_at ? "Đơn đã huỷ sau khi thanh toán." : "Yêu cầu này đã huỷ trước khi thanh toán.";
  }
}

/** Hạn gửi báo giá dự kiến: 1 ngày làm việc sau khi gửi yêu cầu. */
export function expectedQuoteBy(createdAt: string): Date {
  return addBusinessDays(new Date(createdAt), 1);
}

/** Việc tiếp theo — nhìn từ phía vận hành của sàn. */
export function adminNextAction(o: MktOrderLike, now = Date.now()): string {
  switch (o.status) {
    case "requested":
      return "Báo giá";
    case "quoted":
      return isQuoteExpired(o, now) ? "Báo giá lại (đã hết hạn)" : "Chờ khách thanh toán";
    case "paid":
      return "Nhận việc";
    case "in_progress":
      return "Thực hiện và hoàn tất";
    case "completed":
      return "—";
    default:
      return "—";
  }
}

// ─── Dòng thời gian ──────────────────────────────────────────────────────────

export interface TimelineStep {
  key: "requested" | "quoted" | "paid" | "in_progress" | "completed";
  label: string;
  at: string | null;
  state: "done" | "current" | "todo";
}

export interface MktOrderTimes extends MktOrderLike {
  created_at: string;
  quoted_at: string | null;
  paid_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

/** Chữ dưới bước "đang tới" của thanh tiến độ: ai đang phải làm gì. */
export const STEP_WAITING_TEXT: Record<TimelineStep["key"], string> = {
  requested: "",
  quoted: "Đang chờ sàn",
  paid: "Đến lượt bạn",
  in_progress: "Chờ sàn nhận",
  completed: "Đang diễn ra",
};

/** Các bước của đơn. Gói giá cố định bỏ bước báo giá. Huỷ ⇒ các bước chưa tới là "todo". */
export function orderTimeline(o: MktOrderTimes): TimelineStep[] {
  const raw: Omit<TimelineStep, "state">[] = [
    { key: "requested", label: o.pricing === "quote" ? "Gửi yêu cầu" : "Đặt gói", at: o.created_at },
    ...(o.pricing === "quote" ? [{ key: "quoted" as const, label: "Sàn báo giá", at: o.quoted_at }] : []),
    { key: "paid", label: "Thanh toán", at: o.paid_at },
    { key: "in_progress", label: "Sàn nhận việc", at: o.started_at },
    { key: "completed", label: "Hoàn tất", at: o.completed_at },
  ];
  const reached = raw.filter((s) => !!s.at).length;
  return raw.map((s, i) => ({
    ...s,
    state: s.at ? "done" : i === reached && o.status !== "cancelled" ? "current" : "todo",
  }));
}

// ─── Danh sách ───────────────────────────────────────────────────────────────

export type OrderFilter = "dang-mo" | "hoan-tat" | "da-huy";

export const ORDER_FILTERS: readonly { key: OrderFilter; label: string }[] = [
  { key: "dang-mo", label: "Đang mở" },
  { key: "hoan-tat", label: "Hoàn tất" },
  { key: "da-huy", label: "Đã huỷ" },
];

export function orderFilterOf(status: string): OrderFilter {
  if (status === "completed") return "hoan-tat";
  if (status === "cancelled") return "da-huy";
  return "dang-mo";
}

/** Việc của chủ tài sản (báo giá chờ trả, còn hạn) — tô màu số trên tab. */
export const needsOwnerAction = (o: MktOrderLike, now = Date.now()) => o.status === "quoted" && !isQuoteExpired(o, now);

// ─── Lỗi RPC ─────────────────────────────────────────────────────────────────

const REASON_TEXT: Record<string, string> = {
  forbidden: "Bạn chưa có quyền “Gửi / xuất” của mục Truyền thông cho tài sản này. Nhờ Trưởng đơn vị cấp quyền.",
  not_found: "Không tìm thấy đơn — có thể đã bị xoá. Tải lại trang.",
  package_unavailable: "Gói này tạm ngừng nhận đơn.",
  invalid_goal: "Chọn mục tiêu của đợt truyền thông.",
  brief_too_long: `Ghi chú tối đa ${BRIEF_MAX.toLocaleString("en-US")} ký tự.`,
  listing_not_in_workspace: "Tài sản này không còn thuộc đơn vị. Tải lại trang để xem danh sách mới.",
  listing_not_active: "Chỉ đặt được cho tài sản đang mở bán trên sàn.",
  duplicate_open_order: "Tài sản này đã có một đơn cùng gói đang mở. Theo dõi đơn đó trong danh sách bên dưới.",
  quota_exhausted: "Đã dùng hết lượt của gói dịch vụ cho kỳ này. Nâng gói hoặc chờ kỳ làm mới.",
  insufficient: "Số dư credit không đủ. Nạp thêm credit rồi đặt lại.",
  invalid_status: "Đơn đã đổi trạng thái. Tải lại để xem mới nhất.",
  reason_required: "Ghi lý do huỷ (ít nhất 5 ký tự).",
  missing_txn: "Thiếu mã giao dịch thanh toán.",
  quote_expired: "Báo giá đã hết hạn — chờ sàn báo giá lại.",
  quote_changed: "Sàn vừa báo giá lại. Mở đơn để xem giá mới rồi thanh toán.",
  txn_used: "Mã giao dịch đã được dùng cho một khoản khác.",
  invalid_quote: "Giá phải lớn hơn 0 và hiệu lực 1–60 ngày.",
  listing_missing: "Tài sản của đơn không còn trên sàn.",
  invalid_kind: "Loại liên kết không hợp lệ.",
  target_not_found: "Không tìm thấy chiến dịch / banner để gắn.",
  note_required: "Ghi kết quả (5–2.000 ký tự).",
  post_url_required: "Gói đăng mạng xã hội cần link bài đăng.",
  post_url_invalid: "Link bài đăng phải bắt đầu bằng http:// hoặc https://.",
};

export class MktOrderError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

/** {ok:false, reason} của RPC → ném MktOrderError; {ok:true,…} → trả nguyên object. */
export function unwrapMktOrderRpc(data: unknown): Record<string, unknown> {
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.ok !== true) throw new MktOrderError(String(d.reason ?? "unknown"));
  return d;
}

export function mktOrderErrorMessage(err: unknown): string {
  if (err instanceof MktOrderError) return REASON_TEXT[err.reason] ?? "Không thực hiện được. Vui lòng thử lại.";
  const msg = ((err ?? {}) as { message?: string }).message ?? "";
  return msg || "Không thực hiện được. Vui lòng thử lại.";
}

// ─── Đường dẫn ───────────────────────────────────────────────────────────────

/** Tab "Giao việc cho sàn"; `listingId` mở sẵn hộp đặt gói cho tài sản đó. */
export function ownerOrdersHref(listingId?: string | null): string {
  const sp = new URLSearchParams({ tab: "giao-viec" });
  if (listingId) sp.set("dat", listingId);
  return `/chu-tai-san/truyen-thong?${sp.toString()}`;
}

/** Trang VNPay mô phỏng cho một đơn báo giá; trả xong quay về trang chi tiết đơn. */
export function mktOrderCheckoutPath(orderId: string): string {
  const sp = new URLSearchParams({ mkt_order: orderId, return: ownerMarketingOrderHref(orderId) });
  return `/payment/vnpay?${sp.toString()}`;
}

export const ADMIN_MKT_ORDER_PATH = "/admin/yeu-cau-dich-vu/truyen-thong";
