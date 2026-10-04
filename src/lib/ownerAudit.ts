// Nhật ký hoạt động Trạm Điều Hành (/chu-tai-san/nhat-ky) — phần thuần: kiểu dữ liệu,
// nhãn tiếng Việt, định dạng giá trị trong diff, câu tóm tắt một dòng, đường dẫn → đối
// tượng để ghi lượt xem. Luật AI ĐƯỢC XEM gì nằm ở SQL (owner_audit_context, migration
// 20261002120000) — client chỉ hiển thị tầng server trả về.

import { ownerPageTitle } from "@/components/owner-portal/owner-page-titles";
import { formatMoneyFull } from "@/utils/money";
import {
  OWNER_ACTION_LABELS,
  ownerModuleDef,
  type OwnerAction,
  type OwnerModule,
} from "@/lib/ownerWorkspace/permissions";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "view"
  | "login"
  | "logout"
  | "export"
  | "print"
  | "share"
  | "download";
export type AuditActorKind = "member" | "hq" | "platform" | "partner" | "system";
/** Tầng xem — mine / branch / workspace / hq của Trạm, personal ở tenant Cá nhân. */
export type AuditLevel = "mine" | "branch" | "workspace" | "hq" | "personal";
/** Nhóm thao tác cho tab lọc. */
export type AuditKind = "all" | "changes" | "sessions" | "views" | "events";
export type AuditPeriod = "1d" | "7d" | "30d" | "90d" | "365d" | "all";

/** {cột: [trước, sau]} — tạo mới [null, giá trị], xoá [giá trị, null]. */
export type AuditChanges = Record<string, [unknown, unknown]>;

export interface AuditEntry {
  id: number;
  created_at: string;
  last_at: string;
  actor: string | null;
  actor_kind: AuditActorKind;
  actor_label: string;
  module: string | null;
  action: AuditAction;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  branch_id: string | null;
  branch_name: string | null;
  changes: AuditChanges;
  meta: Record<string, unknown>;
  path: string | null;
}

export interface AuditPage {
  level: AuditLevel;
  total: number;
  totalCapped: boolean;
  rows: AuditEntry[];
}

export interface AuditScope {
  level: AuditLevel;
  isOwner: boolean;
  canExport: boolean;
  /** Module người xem có quyền "Xem" (null ở tenant Cá nhân = không giới hạn). */
  modules: string[] | null;
  branches: { id: string; name: string }[];
  actors: { id: string; label: string }[];
}

export interface AuditFilterState {
  q: string;
  kind: AuditKind;
  /** "all" | mã module | "_none" (thao tác không thuộc module nào). */
  module: string;
  /** "all" | uuid người làm | "kind:platform" | "kind:partner" | "kind:system". */
  actor: string;
  /** "all" | uuid chi nhánh. */
  branch: string;
  period: AuditPeriod;
}

export const DEFAULT_AUDIT_FILTERS: AuditFilterState = {
  q: "",
  kind: "all",
  module: "all",
  actor: "all",
  branch: "all",
  period: "30d",
};

// ─── Nhãn ──────────────────────────────────────────────────────────────────

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  create: "Tạo",
  update: "Sửa",
  delete: "Xoá",
  view: "Xem",
  login: "Đăng nhập",
  logout: "Đăng xuất",
  export: "Xuất Excel",
  print: "In / PDF",
  share: "Chia sẻ",
  download: "Tải về",
};

export const AUDIT_KIND_LABELS: Record<AuditKind, string> = {
  all: "Tất cả",
  changes: "Thay đổi dữ liệu",
  sessions: "Đăng nhập / đăng xuất",
  views: "Lượt xem trang",
  events: "Xuất & chia sẻ",
};

export const AUDIT_PERIOD_LABELS: Record<AuditPeriod, string> = {
  "1d": "24 giờ qua",
  "7d": "7 ngày qua",
  "30d": "30 ngày qua",
  "90d": "90 ngày qua",
  "365d": "12 tháng qua",
  all: "Toàn bộ",
};

export const AUDIT_ACTOR_KIND_LABELS: Record<AuditActorKind, string> = {
  member: "Thành viên",
  hq: "Trụ sở",
  platform: "Quản trị sàn",
  partner: "Đối tác",
  system: "Hệ thống",
};

/** Câu giải thích tầng xem — hiện ở đầu trang để người xem biết vì sao thấy ít / nhiều. */
export const AUDIT_LEVEL_COPY: Record<AuditLevel, { title: string; description: string }> = {
  mine: {
    title: "Bạn đang xem thao tác của chính mình",
    description: "Vai trò của bạn chưa có quyền xem nhật ký của mọi người. Trưởng đơn vị cấp quyền này ở mục Vai trò.",
  },
  branch: {
    title: "Bạn đang xem nhật ký các chi nhánh được giao",
    description: "Gồm thao tác trên dữ liệu thuộc chi nhánh trong phạm vi của bạn, ở các module bạn được xem.",
  },
  workspace: {
    title: "Bạn đang xem nhật ký toàn đơn vị",
    description: "Gồm mọi thao tác ở các module bạn được xem.",
  },
  hq: {
    title: "Trụ sở xem nhật ký của chi nhánh",
    description: "Chỉ đọc. Không gồm nhật ký Thành viên, Vai trò và Liên kết của chi nhánh.",
  },
  personal: {
    title: "Nhật ký hồ sơ cá nhân",
    description: "Thao tác của bạn và của sàn / đối tác trên hồ sơ cá nhân của bạn.",
  },
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  asset_postings: "Hồ sơ số hoá",
  asset_posting_dossier_items: "Mục hồ sơ hoàn chỉnh",
  posting_share_links: "Link hồ sơ online",
  craft_village_publications: "Bản đồ làng nghề",
  asset_3d_scans: "Mô hình 3D",
  asset_vr_tour_orders: "Đơn VR tour",
  asset_authentication_orders: "Đơn giám định",
  asset_valuation_orders: "Đơn thẩm định giá",
  auth_sessions: "Phiên đăng nhập",
  asset_legal_consultations: "Tư vấn pháp lý",
  asset_auction_consultations: "Tư vấn đấu giá",
  service_contracts: "Hợp đồng dịch vụ",
  asset_service_requests: "Yêu cầu báo giá",
  asset_broker_requests: "Nhờ sàn chọn tổ chức",
  consignment_contracts: "Hợp đồng ký gửi",
  auction_sale_contracts: "Hợp đồng mua bán",
  asset_owner_claims: "Tài sản khớp về đơn vị",
  owner_asset_outcomes: "Kết quả phiên",
  owner_cash_events: "Sổ thu chi",
  owner_mkt_campaigns: "Chiến dịch truyền thông",
  owner_mkt_links: "Link theo dõi",
  owner_report_snapshots: "Báo cáo định kỳ",
  owner_workspace_targets: "Chỉ tiêu",
  owner_workspace_target_criteria: "Tiêu chí chỉ tiêu",
  workspace_branches: "Chi nhánh",
  asset_owner_workspaces: "Thông tin đơn vị",
  asset_owner_workspace_members: "Thành viên",
  asset_owner_workspace_invites: "Lời mời",
  owner_ws_roles: "Vai trò",
  owner_workspace_link_requests: "Yêu cầu liên kết",
  owner_subscriptions: "Gói dịch vụ",
};

const FIELD_LABELS: Record<string, string> = {
  title: "Tiêu đề",
  description: "Mô tả",
  status: "Trạng thái",
  review_status: "Trạng thái duyệt",
  code: "Mã",
  name: "Tên",
  label: "Nhãn",
  province: "Tỉnh / thành",
  district: "Quận / huyện",
  ward: "Phường / xã",
  address: "Địa chỉ",
  parent_slug: "Nhóm tài sản",
  child_slug: "Loại tài sản",
  pricing_mode: "Cách định giá",
  starting_price: "Giá khởi điểm",
  auction_format: "Hình thức đấu giá",
  commission_pct: "Phí hoa hồng (%)",
  expected_timeline: "Thời gian mong muốn",
  image_urls: "Ảnh",
  video_urls: "Video",
  doc_urls: "Tài liệu",
  ownership_proof_urls: "Giấy tờ sở hữu",
  ownership_declaration: "Cam kết sở hữu",
  has_dispute: "Có tranh chấp",
  has_mortgage: "Đang thế chấp",
  is_seized: "Bị kê biên",
  right_to_sell: "Quyền bán",
  legal_notes: "Ghi chú pháp lý",
  delta_fields: "Thông số phụ",
  submitted_at: "Gửi lúc",
  reviewed_at: "Duyệt lúc",
  rejection_reason: "Lý do từ chối",
  review_notes: "Ghi chú duyệt",
  branch_id: "Chi nhánh",
  branch_scope: "Phạm vi chi nhánh",
  role_id: "Vai trò",
  chosen_org_id: "Tổ chức đấu giá",
  auction_org_id: "Tổ chức đấu giá",
  parent_workspace_id: "Trụ sở",
  parent_linked_at: "Liên kết lúc",
  primary_name: "Tên đơn vị",
  abbreviations: "Tên viết tắt",
  branch_names: "Tên chi nhánh",
  display_name: "Tên hiển thị",
  contact_phone: "SĐT liên hệ",
  phone: "Số điện thoại",
  contact_email: "Email liên hệ",
  email: "Email",
  is_active: "Đang hoạt động",
  is_amc: "Là AMC",
  notes: "Ghi chú",
  note: "Ghi chú",
  amount: "Số tiền",
  kind: "Loại",
  occurred_on: "Ngày phát sinh",
  outcome: "Kết quả",
  failure_reason: "Lý do không thành",
  asset_title: "Tài sản",
  asset_category: "Loại tài sản",
  round_no: "Lượt đấu",
  auction_date: "Ngày đấu giá",
  winning_price: "Giá trúng",
  participants: "Số người tham gia",
  payment_status: "Thanh toán",
  paid_amount: "Đã thu",
  paid_at: "Thu lúc",
  auction_fee: "Phí đấu giá",
  evidence_urls: "Biên bản",
  payment_due_on: "Hạn thanh toán",
  share_to_market: "Chia sẻ lên sàn",
  conflict_resolution: "Xử lý lệch số liệu",
  source: "Nguồn",
  target_amount: "Chỉ tiêu số tiền",
  target_count: "Chỉ tiêu số tài sản",
  period_type: "Kỳ",
  period_start: "Bắt đầu kỳ",
  metric: "Chỉ số",
  goal: "Mục tiêu",
  sort_order: "Thứ tự",
  plan_note: "Kế hoạch kỳ sau",
  payload: "Số liệu báo cáo",
  finalized_at: "Chốt lúc",
  shared_at: "Chia sẻ lúc",
  token_expires_at: "Link hết hạn",
  channel: "Kênh",
  channels: "Kênh",
  listing_ids: "Tài sản",
  mode: "Chế độ",
  drafts: "Nội dung",
  audience_spec: "Đối tượng nhận",
  schedule_type: "Lịch gửi",
  scheduled_at: "Hẹn gửi lúc",
  sent_channels: "Đã gửi qua",
  approved_at: "Duyệt lúc",
  rejected_at: "Từ chối lúc",
  rejected_reason: "Lý do từ chối",
  sent_at: "Gửi lúc",
  expires_at: "Hết hạn",
  revoked_at: "Thu hồi lúc",
  accepted_at: "Chấp nhận lúc",
  joined_at: "Tham gia lúc",
  sender_name: "Người gửi",
  sender_phone: "SĐT người gửi",
  show_price: "Hiện giá",
  show_exact_address: "Hiện địa chỉ chính xác",
  show_sender_contact: "Hiện liên hệ người gửi",
  is_published: "Công khai",
  product: "Sản phẩm",
  plan_name: "Gói",
  price_vnd: "Giá gói",
  term_months: "Thời hạn (tháng)",
  starts_on: "Bắt đầu",
  ends_on: "Kết thúc",
  cancelled_at: "Huỷ lúc",
  cancel_reason: "Lý do huỷ",
  quoted_price: "Giá báo",
  quote_note: "Ghi chú báo giá",
  quoted_at: "Báo giá lúc",
  price: "Giá",
  signed_at: "Ký lúc",
  signed_date: "Ngày ký",
  completed_at: "Hoàn tất lúc",
  verdict: "Kết luận",
  request_note: "Yêu cầu",
  message: "Lời nhắn",
  decline_reason: "Lý do từ chối",
  quote_commission_pct: "Hoa hồng báo giá (%)",
  quote_service_fee: "Phí dịch vụ báo giá",
  quote_starting_price: "Giá khởi điểm đề xuất",
  respond_by: "Hạn trả lời",
  expected_quote_by: "Hạn báo giá",
  appraised_value: "Giá trị thẩm định",
  valuation_date: "Ngày thẩm định",
  valid_until: "Hiệu lực đến",
  certificate_no: "Số chứng thư",
  auth_verdict: "Kết luận giám định",
  legal_conclusion: "Kết luận pháp lý",
  count: "Số lượng",
  permissions_added: "Quyền được thêm",
  permissions_removed: "Quyền bị gỡ",
};

const MONEY_FIELDS = new Set([
  "starting_price",
  "winning_price",
  "paid_amount",
  "auction_fee",
  "amount",
  "quoted_price",
  "price",
  "price_vnd",
  "target_amount",
  "appraised_value",
  "quote_service_fee",
  "quote_starting_price",
  "expected_price",
  "min_acceptable_price",
]);

const STATUS_FIELDS = new Set(["status", "review_status", "payment_status", "outcome"]);

/** Mã trạng thái chung giữa các bảng — mã lạ giữ nguyên. */
const STATUS_LABELS: Record<string, string> = {
  draft: "Nháp",
  submitted: "Đã gửi",
  pending: "Chờ xử lý",
  pending_confirmation: "Chờ xác nhận",
  auto_claimed: "Sàn tự khớp",
  confirmed: "Đã xác nhận",
  rejected: "Từ chối",
  approved: "Đã duyệt",
  active: "Đang hoạt động",
  inactive: "Ngừng",
  removed: "Đã gỡ",
  finalized: "Đã chốt",
  cancelled: "Đã huỷ",
  completed: "Hoàn tất",
  quoted: "Đã báo giá",
  paid: "Đã thanh toán",
  unpaid: "Chưa thu",
  partial: "Thu một phần",
  defaulted: "Bỏ cọc",
  signed: "Đã ký",
  sent: "Đã gửi",
  expired: "Hết hạn",
  accepted: "Đã chấp nhận",
  declined: "Từ chối",
  sold: "Bán được",
  success: "Thành công",
  failed: "Không thành",
  unsold: "Không bán được",
};

export function auditFieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const text = key.replace(/_/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function auditModuleLabel(module: string | null): string {
  if (!module) return "Chung";
  return ownerModuleDef(module)?.label ?? module;
}

export function auditEntityTypeLabel(entityType: string | null): string {
  if (!entityType) return "";
  return AUDIT_ENTITY_LABELS[entityType] ?? entityType;
}

/** "so-hoa:update" → "Số hoá tài sản · Sửa & dịch vụ". */
export function auditPermissionLabel(key: string): string {
  const [module, action] = key.split(":");
  const def = ownerModuleDef(module);
  if (!def) return key;
  const a = action as OwnerAction;
  return `${def.label} · ${def.actionLabels?.[a] ?? OWNER_ACTION_LABELS[a] ?? action}`;
}

// ─── Định dạng giá trị ────────────────────────────────────────────────────

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, "0");

export function formatAuditDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function looksLikeFile(s: string): boolean {
  return /^https?:\/\//.test(s) || /\.[a-z0-9]{2,5}$/i.test(s) || s.split("/").length > 2;
}

/** Một giá trị trong diff → chữ đọc được ("—" khi trống). */
export function formatAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "branch_scope" && Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") {
    return MONEY_FIELDS.has(key) ? formatMoneyFull(value) : value.toLocaleString("en-US");
  }
  if (typeof value === "string") {
    if (MONEY_FIELDS.has(key) && /^-?\d+(\.\d+)?$/.test(value)) return formatMoneyFull(value);
    if (STATUS_FIELDS.has(key)) return STATUS_LABELS[value] ?? value;
    if (ISO_DATETIME.test(value)) return formatAuditDateTime(value);
    if (ISO_DATE.test(value)) {
      const [y, m, d] = value.split("-");
      return `${d}/${m}/${y}`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (key === "permissions_added" || key === "permissions_removed") {
      return value.map((v) => auditPermissionLabel(String(v))).join("; ");
    }
    if (value.every((v) => typeof v === "string")) {
      const items = value as string[];
      if (items.every(looksLikeFile)) return `${items.length} tệp`;
      return items.join(", ");
    }
    return `${value.length} mục`;
  }
  return "(dữ liệu chi tiết)";
}

// ─── Câu tóm tắt ──────────────────────────────────────────────────────────

/** Tiêu đề trang (meta.title) cho lượt xem / xuất / in; rơi về đường dẫn. */
function pageTitleOf(entry: AuditEntry): string {
  const t = entry.meta?.title;
  if (typeof t === "string" && t) return t;
  return (entry.path && ownerPageTitle(entry.path)) || entry.path || "";
}

/** Một dòng mô tả thao tác — cột "Thao tác" của bảng. Đối tượng hiện riêng (entity_label). */
export function auditSummary(entry: AuditEntry): string {
  const type = auditEntityTypeLabel(entry.entity_type).toLowerCase();
  switch (entry.action) {
    case "view":
      return `Xem trang ${pageTitleOf(entry)}`.trim();
    case "login":
      // Dòng 'login' cũ (trước 04/10/2026) do client ghi khi vào cổng, không phải đăng nhập thật.
      return isAuthSession(entry) ? "Đăng nhập" : "Truy cập Trạm Điều Hành";
    case "logout":
      return entry.meta?.reason === "expired" ? "Phiên đăng nhập hết hạn" : "Đăng xuất";
    case "export":
      return `Xuất Excel ${pageTitleOf(entry)}`.trim();
    case "print":
      return `In / lưu PDF ${pageTitleOf(entry)}`.trim();
    case "share":
      return `Chia sẻ ${pageTitleOf(entry)}`.trim();
    case "download":
      return `Tải tệp ${pageTitleOf(entry)}`.trim();
    case "create":
      if (entry.entity_type === "asset_owner_claims" && !entry.entity_id) return "Sàn khớp tài sản về đơn vị";
      return `Tạo ${type}`;
    case "delete":
      return `Xoá ${type}`;
    case "update": {
      const keys = Object.keys(entry.changes ?? {});
      const statusKey = keys.find((k) => STATUS_FIELDS.has(k));
      if (statusKey && keys.length === 1) {
        const [, to] = entry.changes[statusKey];
        return `Đổi ${auditFieldLabel(statusKey).toLowerCase()} ${type} → ${formatAuditValue(statusKey, to)}`;
      }
      if (keys.includes("permissions_added") || keys.includes("permissions_removed")) return `Đổi quyền ${type}`;
      return `Sửa ${type}`;
    }
  }
}

// ─── Đăng nhập / đăng xuất ────────────────────────────────────────────────

/** Dòng do trigger auth.sessions ghi (migration 20261004200000). */
export function isAuthSession(entry: AuditEntry): boolean {
  return entry.meta?.source === "auth";
}

/** "Chrome · macOS" từ user agent — đủ để nhận ra thiết bị, không cần thư viện. */
export function auditDeviceLabel(ua: string | null | undefined): string {
  if (!ua) return "";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /CocCoc|coc_coc/i.test(ua)
        ? "Cốc Cốc"
        : /Firefox\/|FxiOS/.test(ua)
          ? "Firefox"
          : /Chrome\/|CriOS/.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "";
  return [browser, os].filter(Boolean).join(" · ") || "Thiết bị khác";
}

/** 7,260 giây → "2 giờ 1 phút"; dưới 1 phút → "dưới 1 phút". */
export function formatAuditDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const days = Math.floor(s / 86_400);
  const hours = Math.floor((s % 86_400) / 3_600);
  const minutes = Math.floor((s % 3_600) / 60);
  if (days > 0) return hours > 0 ? `${days} ngày ${hours} giờ` : `${days} ngày`;
  if (hours > 0) return minutes > 0 ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
  return minutes > 0 ? `${minutes} phút` : "dưới 1 phút";
}

/** Thiết bị / IP / thời lượng của dòng đăng nhập – đăng xuất, cho hộp chi tiết và file xuất. */
export function auditSessionRows(entry: AuditEntry): { label: string; value: string }[] {
  if (!isAuthSession(entry)) return [];
  const m = entry.meta ?? {};
  const rows: { label: string; value: string }[] = [];
  const device = auditDeviceLabel(typeof m.user_agent === "string" ? m.user_agent : null);
  if (device) rows.push({ label: "Thiết bị", value: device });
  if (typeof m.ip === "string" && m.ip) rows.push({ label: "Địa chỉ IP", value: m.ip });
  const duration = Number(m.duration_seconds);
  if (entry.action === "logout" && Number.isFinite(duration)) {
    rows.push({ label: "Thời lượng phiên", value: formatAuditDuration(duration) });
  }
  return rows;
}

/** "Tiêu đề, Mô tả +2" — các trường đã đổi, cho cột chi tiết thu gọn. */
export function auditChangedFields(entry: AuditEntry, max = 3): string {
  if (entry.action !== "update") return "";
  const labels = Object.keys(entry.changes ?? {}).map(auditFieldLabel);
  if (labels.length <= max) return labels.join(", ");
  return `${labels.slice(0, max).join(", ")} +${labels.length - max}`;
}

/** Diff dạng dòng cho hộp chi tiết / file xuất. */
export function auditChangeRows(entry: AuditEntry): { key: string; label: string; before: string; after: string }[] {
  return Object.entries(entry.changes ?? {}).map(([key, pair]) => {
    const [before, after] = Array.isArray(pair) ? pair : [null, pair];
    return { key, label: auditFieldLabel(key), before: formatAuditValue(key, before), after: formatAuditValue(key, after) };
  });
}

// ─── Liên kết tới bản ghi ─────────────────────────────────────────────────

const BASE = "/chu-tai-san";

/** Trang mở bản ghi của dòng nhật ký — null khi bản ghi đã xoá / không có trang riêng. */
export function auditEntityHref(entry: AuditEntry): string | null {
  if (entry.action === "view" || entry.action === "login" || entry.action === "logout") return entry.path;
  if (entry.action === "delete") return null;
  const id = entry.entity_id;
  const postingId = typeof entry.meta?.posting_id === "string" ? entry.meta.posting_id : null;
  switch (entry.entity_type) {
    case "asset_postings":
      return id ? `${BASE}/dang-tai-san/${id}` : null;
    case "consignment_contracts":
      return id ? `${BASE}/hop-dong/ky-gui/${id}` : null;
    case "auction_sale_contracts":
      return id ? `${BASE}/hop-dong/mua-ban/${id}` : null;
    case "service_contracts":
      return id ? `${BASE}/hop-dong/dich-vu/${id}` : null;
    case "owner_report_snapshots":
      return id ? `${BASE}/bao-cao-dinh-ky/${id}` : null;
    case "owner_workspace_targets":
      return id ? `${BASE}/chi-tieu/${id}` : null;
    case "owner_workspace_target_criteria":
      return typeof entry.meta?.target_id === "string" ? `${BASE}/chi-tieu/${entry.meta.target_id}` : null;
    case "owner_ws_roles":
      return id ? `${BASE}/vai-tro/${id}` : null;
    case "asset_owner_claims":
      return `${BASE}/tai-san`;
    case "owner_asset_outcomes":
      return `${BASE}/ket-qua`;
    case "owner_cash_events":
      return `${BASE}/thu-tien`;
    case "owner_mkt_campaigns":
    case "owner_mkt_links":
      return `${BASE}/truyen-thong`;
    case "workspace_branches":
    case "asset_owner_workspaces":
      return `${BASE}/chi-nhanh-amc`;
    case "asset_owner_workspace_members":
    case "asset_owner_workspace_invites":
      return `${BASE}/thanh-vien`;
    case "owner_workspace_link_requests":
      return `${BASE}/lien-ket`;
    case "owner_subscriptions":
      return `${BASE}/goi-thue-bao`;
    default:
      return postingId ? `${BASE}/dang-tai-san/${postingId}` : null;
  }
}

// ─── Đường dẫn → đối tượng (ghi lượt xem) ────────────────────────────────

export interface AuditPageTarget {
  module: OwnerModule | null;
  entityType: string | null;
  entityId: string | null;
  title: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MODULE_BY_SEGMENT: Record<string, OwnerModule> = {
  "chi-tieu": "chi-tieu",
  "tai-san": "tai-san",
  "ket-qua": "ket-qua",
  "dang-tai-san": "so-hoa",
  "ky-gui-dau-gia": "ky-gui",
  "thu-tien": "thu-tien",
  "truyen-thong": "truyen-thong",
  "bao-cao": "phan-tich",
  "doi-tac": "phan-tich",
  "dong-tien": "dong-tien",
  "bao-cao-dinh-ky": "bao-cao-dinh-ky",
  "chi-nhanh-amc": "chi-nhanh",
  "thanh-vien": "thanh-vien",
  "vai-tro": "vai-tro",
  "lien-ket": "lien-ket",
  "nhat-ky": "nhat-ky",
};

const CONTRACT_KINDS: Record<string, { module: OwnerModule; entityType: string }> = {
  "ky-gui": { module: "ky-gui", entityType: "consignment_contracts" },
  "mua-ban": { module: "hop-dong-mua-ban", entityType: "auction_sale_contracts" },
  "dich-vu": { module: "so-hoa", entityType: "service_contracts" },
};

const ENTITY_BY_SEGMENT: Record<string, string> = {
  "dang-tai-san": "asset_postings",
  "ky-gui-dau-gia": "asset_postings",
  "bao-cao-dinh-ky": "owner_report_snapshots",
  "chi-tieu": "owner_workspace_targets",
  "vai-tro": "owner_ws_roles",
};

/** Trang trong cổng → module + bản ghi (server tự tra nhãn). Ngoài cổng ⇒ null. */
export function auditTargetFromPath(pathname: string): AuditPageTarget | null {
  const clean = pathname.replace(/\/+$/, "");
  const [, root, first, second, third] = clean.split("/");
  if (root !== "chu-tai-san") return null;
  const title = ownerPageTitle(clean) ?? null;
  if (!first) return { module: null, entityType: null, entityId: null, title };

  if (first === "hop-dong") {
    const kind = second ? CONTRACT_KINDS[second] : undefined;
    if (kind && third && UUID.test(third)) {
      return { module: kind.module, entityType: kind.entityType, entityId: third, title };
    }
    return { module: null, entityType: null, entityId: null, title };
  }

  const module = MODULE_BY_SEGMENT[first] ?? null;
  const entityType = ENTITY_BY_SEGMENT[first];
  if (entityType && second && UUID.test(second)) {
    return { module, entityType, entityId: second, title };
  }
  return { module, entityType: null, entityId: null, title };
}

// ─── Bộ lọc → tham số RPC ─────────────────────────────────────────────────

const PERIOD_DAYS: Record<Exclude<AuditPeriod, "all">, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90, "365d": 365 };

/** p_filters của owner_audit_list. `now` truyền vào để test tất định. */
export function auditFiltersToRpc(f: AuditFilterState, now: Date = new Date()): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const q = f.q.trim();
  if (q) out.q = q;
  if (f.kind !== "all") out.kind = f.kind;
  if (f.module !== "all") out.modules = [f.module];
  if (f.actor.startsWith("kind:")) out.actor_kind = f.actor.slice(5);
  else if (f.actor !== "all") out.actor = f.actor;
  if (f.branch !== "all") out.branch = f.branch;
  if (f.period !== "all") {
    out.from = new Date(now.getTime() - PERIOD_DAYS[f.period] * 86_400_000).toISOString();
  }
  return out;
}

/** Ép dữ liệu RPC về kiểu chặt — bỏ qua trường lạ. */
export function parseAuditPage(raw: unknown): AuditPage {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    level: (r.level as AuditLevel) ?? "mine",
    total: Number(r.total ?? 0),
    totalCapped: Boolean(r.total_capped),
    rows: Array.isArray(r.rows) ? (r.rows as AuditEntry[]) : [],
  };
}

export function parseAuditScope(raw: unknown): AuditScope {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    level: (r.level as AuditLevel) ?? "mine",
    isOwner: Boolean(r.is_owner),
    canExport: Boolean(r.can_export),
    modules: Array.isArray(r.modules) ? (r.modules as string[]) : null,
    branches: Array.isArray(r.branches) ? (r.branches as AuditScope["branches"]) : [],
    actors: Array.isArray(r.actors) ? (r.actors as AuditScope["actors"]) : [],
  };
}

/** Tầng thấy thao tác của người khác ⇒ có lọc theo người / chi nhánh. */
export function auditSeesOthers(level: AuditLevel): boolean {
  return level === "workspace" || level === "branch" || level === "hq" || level === "personal";
}
