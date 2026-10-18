// Logic thuần cho tab "Hồ sơ tham gia" và trang chi tiết hồ sơ ở portal tổ chức
// (design "Phien Dau Gia - Cong Cong Ty": pdg-tabs.js contractsTab + pdg-hoso.js).
//
// Quyết định 2026-10-11: nút duyệt ở đầu trang theo ĐÚNG design — chỉ khi hồ sơ
// còn "Chờ duyệt" / "Cần bổ sung". Thu hồi một hồ sơ đã duyệt (server vẫn cho tới
// lúc điểm danh) không bày trên giao diện nữa.

import type { PillTone } from "@/components/portal/auction-sessions/list/SessionStatePill";
import { formatVnd } from "@/lib/advertising/slug";
import { foldText } from "@/lib/biddingContracts/filters";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { reviewActionsFor } from "@/lib/biddingContracts/review";
import type { DepositEventKind } from "@/types/auction-bidding";
import {
  DEPOSIT_METHOD_LABELS,
  ID_TYPE_LABELS,
  KYC_FIELD_LABELS,
  REVIEW_EVENT_LABELS,
  type ContractWithSession,
  type DepositStatus,
  type ReviewDecision,
  type ReviewEventKind,
  type ReviewStatus,
} from "@/types/bidding-contract";

export interface Pill {
  label: string;
  tone: PillTone;
}

export const REVIEW_PILL: Record<ReviewStatus, Pill> = {
  pending: { label: "Chờ duyệt", tone: "warning" },
  approved: { label: "Đã duyệt", tone: "ok" },
  needs_info: { label: "Cần bổ sung", tone: "info" },
  rejected: { label: "Từ chối", tone: "muted" },
};

/** Design chỉ có 3 trạng thái; 3 trạng thái sau chốt phiên giữ nhãn của sổ tiền đặt trước. */
export const DEPOSIT_PILL: Record<DepositStatus, Pill> = {
  pending: { label: "Chưa nộp", tone: "muted" },
  received: { label: "Đã nộp", tone: "ok" },
  refunded: { label: "Đã hoàn trả", tone: "muted" },
  applied: { label: "Chuyển vào tiền mua", tone: "info" },
  pending_refund: { label: "Chờ hoàn trả", tone: "warning" },
  forfeited: { label: "Không hoàn trả", tone: "live" },
};

/** Nhãn tiền đặt trước phía tổ chức: còn 'pending' mà người mua đã báo nộp ⇒ "Chờ đối soát" (20261018160000). */
export function depositPillOf(c: { deposit_status: DepositStatus; deposit_reported_at?: string | null }): Pill {
  return c.deposit_status === "pending" && c.deposit_reported_at
    ? { label: "Chờ đối soát", tone: "info" }
    : DEPOSIT_PILL[c.deposit_status];
}

/** Hồ sơ bị từ chối: status 'refunded' (hoàn tiền hồ sơ) đi cùng review 'rejected'. */
export const isRejected = (c: Pick<ContractWithSession, "status" | "review_status">) =>
  c.status === "refunded" || c.review_status === "rejected";

/** Tên hiển thị: tên tổ chức nếu người mua là tổ chức, không thì họ tên. */
export const displayNameOf = (c: Pick<ContractWithSession, "org_name" | "full_name">) => c.org_name ?? c.full_name;

// ─── Danh sách trong tab ─────────────────────────────────────────────────────

export type ReviewFilter = ReviewStatus | "all";
export type DepositFilter = DepositStatus | "all";

export const REVIEW_FILTERS: [ReviewFilter, string][] = [
  ["all", "Tất cả"],
  ["pending", "Chờ duyệt"],
  ["needs_info", "Cần bổ sung"],
  ["approved", "Đã duyệt"],
  ["rejected", "Từ chối"],
];

/** 3 lựa chọn của design; trạng thái sau chốt phiên chỉ hiện khi có hồ sơ mang nó. */
const DEPOSIT_FILTER_ORDER: DepositStatus[] = ["received", "pending", "refunded", "pending_refund", "applied", "forfeited"];
const DESIGN_DEPOSIT = new Set<DepositStatus>(["received", "pending", "refunded"]);

export function depositFilterOptions(rows: { deposit_status: DepositStatus }[]): [DepositFilter, string, number][] {
  const count = (k: DepositStatus) => rows.filter((r) => r.deposit_status === k).length;
  return [
    ["all", "Tất cả", rows.length] as [DepositFilter, string, number],
    ...DEPOSIT_FILTER_ORDER.filter((k) => DESIGN_DEPOSIT.has(k) || count(k) > 0).map(
      (k): [DepositFilter, string, number] => [k, DEPOSIT_PILL[k].label, count(k)],
    ),
  ];
}

type ListRow = Pick<
  ContractWithSession,
  "review_status" | "deposit_status" | "code" | "full_name" | "org_name" | "phone" | "id_number"
>;

/** Lọc theo chip duyệt + đặt trước + ô tìm; "Tất cả" đẩy hồ sơ chờ duyệt lên đầu như design. */
export function filterTabContracts<T extends ListRow>(rows: T[], review: ReviewFilter, deposit: DepositFilter, q: string): T[] {
  const needle = foldText(q.trim());
  const out = rows.filter((r) => {
    if (review !== "all" && r.review_status !== review) return false;
    if (deposit !== "all" && r.deposit_status !== deposit) return false;
    if (!needle) return true;
    return foldText([r.code, r.full_name, r.org_name ?? "", r.phone, r.id_number].join(" ")).includes(needle);
  });
  if (review !== "all") return out;
  // sort ổn định: chỉ tách nhóm chờ duyệt, giữ thứ tự gốc trong từng nhóm.
  return [...out].sort((a, b) => (a.review_status === "pending" ? 0 : 1) - (b.review_status === "pending" ? 0 : 1));
}

export type RowAction = "review" | "deposit" | "view";

/** Nút cuối dòng: "Xem & duyệt" / "Ghi nhận đặt trước" / "Xem chi tiết". */
export function rowActionOf(
  c: Pick<ContractWithSession, "status" | "review_status" | "deposit_status">,
  sessionCancelled: boolean,
): RowAction {
  if (sessionCancelled || c.status !== "paid") return "view";
  if (c.review_status === "pending") return "review";
  if (c.review_status === "approved" && c.deposit_status === "pending") return "deposit";
  return "view";
}

// ─── Đầu trang chi tiết ──────────────────────────────────────────────────────

/** Thứ tự nút của design: Từ chối · Yêu cầu bổ sung · Phê duyệt. */
const DECISION_ORDER: ReviewDecision[] = ["rejected", "needs_info", "approved"];

export interface HeaderActions {
  decisions: ReviewDecision[];
  /** Dòng trạng thái thay cho nút khi không còn gì để duyệt. */
  statusLine: string | null;
}

export function headerActionsOf(c: ContractWithSession): HeaderActions {
  const open = c.review_status === "pending" || c.review_status === "needs_info";
  const allowed = open ? reviewActionsFor(c) : { decisions: [], blockedNote: null };
  const decisions = DECISION_ORDER.filter((d) => allowed.decisions.includes(d));
  if (decisions.length > 0) return { decisions, statusLine: null };

  let statusLine: string;
  if (isRejected(c)) statusLine = "Hồ sơ đã bị từ chối";
  else if (c.auction_sessions?.status === "cancelled") statusLine = "Phiên đã huỷ";
  else if (c.review_status === "approved") {
    statusLine = `Đã duyệt — đủ điều kiện điểm danh${c.deposit_status === "pending" ? " khi nộp đủ tiền đặt trước" : ""}`;
  } else statusLine = allowed.blockedNote ?? "Đã đóng nhận hồ sơ";
  return { decisions: [], statusLine };
}

// ─── Giấy tờ ─────────────────────────────────────────────────────────────────

export interface ContractDocument {
  key: string;
  label: string;
  /** "JPG" / "PDF" — đuôi tệp. */
  meta: string;
  path: string;
  isImage: boolean;
  /** Cảnh báo vàng trên thẻ (người mua sửa thông tin máy đọc từ ảnh này). */
  flag: string | null;
}

const extOf = (path: string) => (path.split(".").pop() ?? "").toUpperCase();
const IMAGE_EXT = new Set(["JPG", "JPEG", "PNG", "WEBP", "HEIC"]);

function editedFlag(fields: string[] | null | undefined): string | null {
  if (!fields?.length) return null;
  const names = fields.map((f) => KYC_FIELD_LABELS[f as keyof typeof KYC_FIELD_LABELS] ?? f);
  return `Đã sửa so với máy đọc: ${names.join(", ")}`;
}

/** Giấy tờ đính kèm hồ sơ, theo thứ tự design: tổ chức → người đăng ký/ĐDPL → uỷ quyền. */
export function contractDocuments(c: ContractWithSession): ContractDocument[] {
  const org = c.buyer_kind === "organization";
  const who = org ? " người đại diện" : "";
  const idName = (type: ContractWithSession["id_type"]) => ID_TYPE_LABELS[type];
  const raw: [string, string, string | null, string | null][] = [];
  if (org) raw.push(["org_reg", "Giấy chứng nhận ĐKDN", c.org_reg_doc_path, null]);
  if (c.id_type === "passport") {
    raw.push(["id_front", `Hộ chiếu${who} — trang thông tin`, c.id_front_path, editedFlag(c.id_edited_fields)]);
  } else {
    raw.push(["id_front", `${idName(c.id_type)}${who} mặt trước`, c.id_front_path, editedFlag(c.id_edited_fields)]);
    raw.push(["id_back", `${idName(c.id_type)}${who} mặt sau`, c.id_back_path, null]);
  }
  if (c.has_proxy) {
    const pt = c.proxy_id_type ?? "cccd";
    const flag = editedFlag(c.proxy_id_edited_fields);
    if (pt === "passport") raw.push(["proxy_front", "Hộ chiếu người được uỷ quyền", c.proxy_id_front_path, flag]);
    else {
      raw.push(["proxy_front", `${idName(pt)} người được uỷ quyền mặt trước`, c.proxy_id_front_path, flag]);
      raw.push(["proxy_back", `${idName(pt)} người được uỷ quyền mặt sau`, c.proxy_id_back_path, null]);
    }
    raw.push(["poa", "Giấy uỷ quyền tham gia", c.poa_doc_path, null]);
  }
  return raw
    .filter((r): r is [string, string, string, string | null] => !!r[2])
    .map(([key, label, path, flag]) => ({ key, label, path, meta: extOf(path), isImage: IMAGE_EXT.has(extOf(path)), flag }));
}

// ─── Tiền đặt trước ──────────────────────────────────────────────────────────

/**
 * "Ghi nhận đã hoàn trả" trên thẻ: `mark` = chờ hoàn trả (từ chối hồ sơ / chốt phiên /
 * miễn trừ vắng) đi qua org_mark_deposit_refunded; `set` = phiên huỷ khi đã nộp, đi qua
 * org_set_contract_deposit. Các chuyển khác nằm trong hộp thoại Sửa.
 */
export function refundActionOf(c: ContractWithSession): "mark" | "set" | null {
  if (c.deposit_status === "pending_refund") return "mark";
  if (c.deposit_status === "received" && c.auction_sessions?.status === "cancelled" && !c.auction_sessions.finalized_at) {
    return "set";
  }
  return null;
}

export const depositMethodLabel = (m: ContractWithSession["deposit_method"]) => (m ? DEPOSIT_METHOD_LABELS[m] : null);

// ─── Lịch sử ─────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  at: string;
  text: string;
  actor: string;
}

interface ReviewEventLike {
  kind: ReviewEventKind;
  at: string;
  note: string | null;
}
interface DepositEventLike {
  kind: DepositEventKind;
  at: string;
  amount: number | null;
  actor_id: string | null;
}

const DEPOSIT_EVENT_TEXT: Record<DepositEventKind, (amount: string) => string> = {
  received: (a) => `Ghi nhận tiền đặt trước ${a}`,
  applied: (a) => `Chuyển ${a} tiền đặt trước vào tiền mua tài sản`,
  pending_refund: () => "Tiền đặt trước chuyển sang chờ hoàn trả",
  refunded: () => "Hoàn trả tiền đặt trước",
  forfeited: () => "Không hoàn trả tiền đặt trước",
  reversed: () => "Chuyển tiền đặt trước về chưa nhận",
};

/** Gộp mua hồ sơ + nhật ký duyệt + sổ tiền đặt trước + điểm danh, mới nhất lên đầu. */
export function contractHistory(
  c: ContractWithSession,
  reviewEvents: ReviewEventLike[],
  depositEvents: DepositEventLike[],
): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  if (c.paid_at) {
    out.push({ at: c.paid_at, text: `Mua hồ sơ và thanh toán phí qua sàn · ${formatVnd(c.fee_amount)}`, actor: "Người đăng ký" });
  }
  for (const e of reviewEvents) {
    // "Nộp hồ sơ" trùng thời điểm thanh toán — dòng mua hồ sơ ở trên đã nói.
    if (e.kind === "submitted") continue;
    const note = e.note && (e.kind === "needs_info" || e.kind === "rejected") ? ` — ${e.note}` : "";
    out.push({
      at: e.at,
      text: `${REVIEW_EVENT_LABELS[e.kind]}${note}`,
      actor: e.kind === "resubmitted" ? "Người đăng ký" : "Chuyên viên",
    });
  }
  for (const e of depositEvents) {
    out.push({
      at: e.at,
      text: DEPOSIT_EVENT_TEXT[e.kind](formatVnd(e.amount)),
      actor: e.actor_id ? "Chuyên viên" : "Hệ thống",
    });
  }
  if (c.status === "refunded" && c.refunded_at) {
    out.push({ at: c.refunded_at, text: `Hoàn tiền hồ sơ ${formatVnd(c.fee_amount)}`, actor: "Hệ thống" });
  }
  if (c.checked_in_at) {
    const no = formatBidderNo(c.bidder_no);
    out.push({ at: c.checked_in_at, text: `Điểm danh${no ? ` — SBD ${no}` : ""}`, actor: "Người tham gia" });
  }
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// ─── Xuất danh sách ──────────────────────────────────────────────────────────

const BOM = String.fromCharCode(0xfeff);

const csvCell = (v: string | number | null | undefined) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * CSV (UTF-8, có BOM để Excel đọc đúng dấu) của danh sách đang lọc. `withSession`
 * thêm cột mã + tên phiên — dùng ở danh sách toàn tổ chức (nhiều phiên).
 */
export function contractsCsv(rows: ContractWithSession[], opts: { withSession?: boolean } = {}): string {
  const sessionHead = opts.withSession ? ["Mã phiên", "Phiên"] : [];
  const head = ["Mã hồ sơ", ...sessionHead, "Ngày nộp", "Người đăng ký", "Tổ chức", "Điện thoại", "Email", "Giấy tờ", "Số giấy tờ", "Duyệt hồ sơ", "Tiền đặt trước", "Số tiền đã nhận"];
  const lines = rows.map((r) =>
    [
      r.code,
      ...(opts.withSession ? [r.auction_sessions?.code, r.auction_sessions?.title] : []),
      r.paid_at ? new Date(r.paid_at).toLocaleString("vi-VN") : "",
      r.full_name,
      r.org_name,
      r.phone,
      r.email,
      ID_TYPE_LABELS[r.id_type],
      r.id_number,
      REVIEW_PILL[r.review_status].label,
      DEPOSIT_PILL[r.deposit_status].label,
      r.deposit_amount_received,
    ]
      .map(csvCell)
      .join(","),
  );
  return BOM + [head.join(","), ...lines].join("\n");
}

// ─── Định dạng ngày giờ của design ───────────────────────────────────────────

const p2 = (n: number) => String(n).padStart(2, "0");

/** "08/10 14:30" — cột "Nộp …" trong bảng (design `fdt`). */
export function formatDayMonthTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** "08/10/2026 14:30" (design `fdmy`). */
export function formatFullDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** "08/10/2026". */
export function formatDayMonthYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** yyyy-mm-dd theo giờ máy — giá trị cho <input type="date">. */
export function toDateInput(iso: string | null | undefined, fallback = new Date()): string {
  const d = iso ? new Date(iso) : fallback;
  const v = Number.isNaN(d.getTime()) ? fallback : d;
  return `${v.getFullYear()}-${p2(v.getMonth() + 1)}-${p2(v.getDate())}`;
}
