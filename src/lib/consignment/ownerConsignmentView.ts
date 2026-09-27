// Mô hình hiển thị của menu "Ký gửi đấu giá" (thiết kế "Ky Gui Dau Gia - Danh sach
// & Chi tiet"): giai đoạn ký gửi (consignmentStageOf) → MỘT nhãn, MỘT bên phải
// làm, MỘT vị trí trên thanh 3 bước; cộng các phép tính của bảng so sánh báo giá
// và nhật ký hoạt động. Hàm thuần — không đọc DB, không React.
//
// "Việc của bạn" lấy `owner_action` của RPC owner_consignment_summary (cùng nguồn
// với số trên menu), KHÔNG suy từ giai đoạn: người chỉ có quyền xem thì không có
// việc gì, dù hồ sơ đang ở lượt chủ tài sản.

import { formatMoneyShort } from "@/utils/money";
import type { OwnerStatusTone } from "@/lib/ownerStatusTone";
import type { OwnerConsignmentStage } from "./ownerConsignment";
import type { OwnerAction } from "./postingBadge";
import type {
  BrokerRequestStatus,
  QuotePlan,
  ServiceRequestOrigin,
  ServiceRequestStatus,
} from "@/types/asset-posting";
import type { ConsignmentContractStatus } from "@/types/consignment-contract";

// ─── Giai đoạn ───────────────────────────────────────────────────────────────

export const KG_TRACK = ["Gửi tổ chức", "Nhận báo giá", "Chọn tổ chức"] as const;

/**
 * Sáu giai đoạn của thiết kế. Hợp đồng dịch vụ gộp vào "Đã chọn tổ chức" — hợp
 * đồng được theo dõi ở menu Hợp đồng; "nhờ sàn" tách khỏi "chờ báo giá".
 */
export type KgStage = "chua_gui" | "cho_bao_gia" | "nho_san" | "het_to_chuc" | "cho_chon" | "da_chon";

/** Bên đang phải làm bước tiếp theo; null = không còn việc trong luồng ký gửi. */
export type KgWho = "owner" | "org" | "platform" | null;

const META: Record<KgStage, { label: string; step: number; who: KgWho }> = {
  chua_gui: { label: "Chưa gửi tổ chức", step: 0, who: "owner" },
  cho_bao_gia: { label: "Chờ báo giá", step: 1, who: "org" },
  nho_san: { label: "Sàn đang tìm tổ chức", step: 1, who: "platform" },
  het_to_chuc: { label: "Cần gửi thêm tổ chức", step: 1, who: "owner" },
  cho_chon: { label: "Chờ bạn chọn báo giá", step: 2, who: "owner" },
  da_chon: { label: "Đã chọn tổ chức", step: 3, who: null },
};

export function kgStageOf(stage: OwnerConsignmentStage, brokerOpen: boolean): KgStage {
  switch (stage) {
    case "da_chon":
    case "hop_dong":
    case "da_ky":
      return "da_chon";
    case "cho_bao_gia":
      return brokerOpen ? "nho_san" : "cho_bao_gia";
    default:
      return stage;
  }
}

export interface KgStatus {
  stage: KgStage;
  label: string;
  /** Số bước ĐÃ xong trên KG_TRACK (0–3) — cũng là chỉ số bước hiện tại. */
  step: number;
  who: KgWho;
  /** Người đang xem có việc phải làm (owner_action của RPC). */
  mine: boolean;
  tone: OwnerStatusTone;
  ownerAction: OwnerAction | null;
}

export function kgStatusOf(stage: KgStage, ownerAction: OwnerAction | null): KgStatus {
  const m = META[stage];
  const mine = ownerAction !== null;
  // Việc hợp đồng (xác nhận / bổ sung địa chỉ) vẫn là lượt chủ tài sản dù đã chọn tổ chức.
  const who: KgWho = mine ? "owner" : m.who;
  const tone: OwnerStatusTone =
    stage === "het_to_chuc" ? "err" : who === "owner" ? "me" : stage === "da_chon" ? "ok" : "wait";
  return { stage, label: m.label, step: m.step, who, mine, tone, ownerAction };
}

/** Dòng nhỏ phía trên câu "bước tiếp theo". */
export function kgWhoLabel(s: KgStatus): string | null {
  if (s.mine) return "Việc của bạn";
  switch (s.who) {
    case "owner":
      return "Chờ chủ tài sản";
    case "org":
      return "Chờ tổ chức";
    case "platform":
      return "Chờ sàn";
    default:
      return null;
  }
}

export interface KgNextFacts {
  /** Tổ chức đã nhận mà chưa trả lời (sent/seen). */
  waitingCount: number;
  /** Mọi yêu cầu đã gửi, kể cả đã chết. */
  sentCount: number;
  declinedCount: number;
  quotedCount: number;
  /** Tổ chức đã chọn (nếu có). */
  orgName: string | null;
}

/** Câu "bước tiếp theo" — cột cuối bảng danh sách. */
export function kgNextLine(s: KgStatus, f: KgNextFacts): string {
  switch (s.stage) {
    case "chua_gui":
      return "Gửi hồ sơ cho tổ chức đấu giá";
    case "cho_bao_gia":
      return `Đang chờ ${f.waitingCount} tổ chức báo giá`;
    case "nho_san":
      return "Sàn đang tìm tổ chức phù hợp";
    case "het_to_chuc":
      if (f.sentCount === 1) return "Tổ chức đã không nhận hồ sơ";
      return f.declinedCount === f.sentCount
        ? `Cả ${f.sentCount} tổ chức đều từ chối`
        : "Các tổ chức đã gửi đều không nhận hồ sơ";
    case "cho_chon":
      return f.quotedCount === 1 ? "Xem và chọn báo giá nhận được" : `So sánh và chọn 1 trong ${f.quotedCount} báo giá`;
    case "da_chon": {
      const org = f.orgName ?? "tổ chức đấu giá";
      if (s.ownerAction === "confirm_contract") return `Xác nhận hợp đồng với ${org}`;
      if (s.ownerAction === "add_address") return "Bổ sung địa chỉ để lập hợp đồng";
      return `Đã chọn ${org}`;
    }
  }
}

/** Trạng thái một yêu cầu, nói ngắn (tooltip chấm tổ chức, dòng tổ chức ở chi tiết). */
export const KG_REQUEST_LABEL: Record<ServiceRequestStatus, string> = {
  sent: "Đã gửi",
  seen: "Đã xem",
  quoted: "Đã báo giá",
  accepted: "Đã chọn",
  selected: "Đã chọn",
  declined: "Từ chối",
  not_selected: "Đóng · không được chọn",
  withdrawn: "Đã thu hồi",
  contract_cancelled: "Hợp đồng đã huỷ",
};

// ─── Tổ chức: tên ngắn + chữ viết tắt ────────────────────────────────────────

/** Tiền tố loại hình bỏ đi khi rút gọn tên ("Công ty Đấu giá hợp danh Lạc Việt" → "Lạc Việt"). */
const ORG_PREFIX_WORDS = new Set([
  "cong", "ty", "co", "phan", "cp", "tnhh", "mtv", "mot", "thanh", "vien",
  "dau", "gia", "hop", "danh", "dghd", "trung", "tam", "dich", "vu", "tai", "san",
  "chi", "nhanh", "doanh", "nghiep", "tu", "nhan", "dntn", "tinh", "pho", "tp",
]);

const fold = (w: string) =>
  w
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Bỏ tiền tố loại hình ở ĐẦU tên; tên toàn tiền tố thì giữ nguyên. */
export function orgShortName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < words.length && ORG_PREFIX_WORDS.has(fold(words[i]))) i++;
  const rest = words.slice(i);
  return rest.length ? rest.join(" ") : name.trim();
}

/** "Hà Nội · 312 phiên · 94% thành công" — bỏ phần nào không có dữ liệu. */
export function orgSubLine(province: string | null | undefined, record: string | null | undefined): string | null {
  return [province, record].filter(Boolean).join(" · ") || null;
}

/** Hai chữ đầu của tên ngắn, giữ "Đ" ("Đông Á" → "ĐA"). */
export function orgInitials(name: string): string {
  const letter = (w: string) => {
    const c = w.charAt(0);
    if (c === "đ" || c === "Đ") return "Đ";
    return c.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  };
  const words = orgShortName(name).split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return letter(words[0]) + letter(words[1]);
}

// ─── Báo giá ─────────────────────────────────────────────────────────────────

export const formatPct = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;

/**
 * Tổng chi phí ƯỚC TÍNH = thù lao × giá khởi điểm + phí dịch vụ. Thù lao thật tính
 * trên giá trúng — con số này chỉ để so sánh các báo giá với nhau.
 */
export function estimatedCost(pct: number | null, fee: number | null, price: number | null): number | null {
  if (pct == null || price == null) return null;
  return (price * pct) / 100 + (fee ?? 0);
}

/** Giá trị tốt nhất của một hàng so sánh — chỉ khi có ÍT NHẤT hai số để so. */
export function bestOf(values: (number | null)[], dir: "min" | "max"): number | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length < 2) return null;
  const best = dir === "min" ? Math.min(...nums) : Math.max(...nums);
  // Mọi báo giá bằng nhau thì không có "tốt nhất".
  return nums.every((v) => v === best) ? null : best;
}

/** "10%" hoặc "50 tr" — tiền đặt trước theo phương án báo giá. */
export function depositLabel(plan: QuotePlan | null): string | null {
  if (!plan || plan.deposit_value == null) return null;
  return plan.deposit_mode === "amount" ? formatMoneyShort(plan.deposit_value) : formatPct(plan.deposit_value);
}

// ─── Nhật ký hoạt động ───────────────────────────────────────────────────────

export interface KgLogRequest {
  orgName: string | null;
  status: ServiceRequestStatus;
  origin: ServiceRequestOrigin;
  created_at: string;
  seen_at: string | null;
  quoted_at: string | null;
  updated_at: string;
  reopened_at: string | null;
}

export interface KgLogInput {
  submittedAt: string | null;
  /** Chỉ khi hồ sơ đang ở trạng thái đã duyệt. */
  approvedAt: string | null;
  requests: KgLogRequest[];
  broker: { status: BrokerRequestStatus; created_at: string; updated_at: string } | null;
  contracts: { status: ConsignmentContractStatus; signed_at: string | null; cancelled_at: string | null }[];
}

export interface KgLogEntry {
  at: string;
  text: string;
}

const dayKey = (iso: string) => iso.slice(0, 10);

/** Sự kiện của luồng ký gửi, mới nhất trước. Mốc từ chối / chọn lấy updated_at của dòng. */
export function kgActivityLog(input: KgLogInput): KgLogEntry[] {
  const out: KgLogEntry[] = [];
  const short = (r: KgLogRequest) => (r.orgName ? orgShortName(r.orgName) : "Tổ chức đấu giá");

  if (input.submittedAt) out.push({ at: input.submittedAt, text: "Bạn gửi hồ sơ để sàn duyệt" });
  if (input.approvedAt) out.push({ at: input.approvedAt, text: "Sàn duyệt hồ sơ số hoá" });

  if (input.broker) {
    out.push({ at: input.broker.created_at, text: "Bạn nhờ sàn chọn tổ chức giúp" });
    if (input.broker.status === "cancelled") out.push({ at: input.broker.updated_at, text: "Bạn huỷ yêu cầu nhờ sàn" });
  }

  // Gửi hàng loạt: gộp theo ngày + bên gửi thành một dòng.
  const batches = new Map<string, { at: string; origin: ServiceRequestOrigin; n: number }>();
  for (const r of input.requests) {
    const key = `${r.origin}:${dayKey(r.created_at)}`;
    const b = batches.get(key);
    if (b) {
      b.n += 1;
      if (r.created_at < b.at) b.at = r.created_at;
    } else batches.set(key, { at: r.created_at, origin: r.origin, n: 1 });
  }
  for (const b of batches.values()) {
    out.push({ at: b.at, text: `${b.origin === "platform" ? "Sàn" : "Bạn"} gửi hồ sơ cho ${b.n} tổ chức` });
  }

  const selected = input.requests.find((r) => r.status === "selected" || r.status === "accepted");
  for (const r of input.requests) {
    if (r.seen_at) out.push({ at: r.seen_at, text: `${short(r)} đã xem hồ sơ` });
    if (r.quoted_at) out.push({ at: r.quoted_at, text: `${short(r)} gửi báo giá` });
    if (r.reopened_at) out.push({ at: r.reopened_at, text: `Báo giá của ${short(r)} mở lại sau khi hợp đồng bị huỷ` });
    if (r.status === "declined") out.push({ at: r.updated_at, text: `${short(r)} từ chối nhận hồ sơ` });
  }
  if (selected) {
    const closed = input.requests.filter((r) => r.status === "not_selected").length;
    out.push({
      at: selected.updated_at,
      text: `Bạn chọn ${short(selected)}${closed ? ` · ${closed} yêu cầu khác đóng lại` : ""}`,
    });
  }

  for (const c of input.contracts) {
    if (c.signed_at) out.push({ at: c.signed_at, text: "Hợp đồng dịch vụ có hiệu lực" });
    if (c.cancelled_at) out.push({ at: c.cancelled_at, text: "Hợp đồng dịch vụ bị huỷ" });
  }

  return out.sort((a, b) => b.at.localeCompare(a.at));
}
