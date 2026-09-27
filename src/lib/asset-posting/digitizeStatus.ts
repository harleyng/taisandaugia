// Trạng thái GỘP của một hồ sơ trên menu "Số hoá tài sản" (thiết kế "So Hoa Tai San
// - Danh sach & Chi tiet"): status + review_status + giai đoạn ký gửi → MỘT nhãn,
// MỘT bên phải làm, MỘT vị trí trên thanh 4 bước.
//
// Giai đoạn ký gửi lấy từ consignmentStageOf (menu "Ký gửi đấu giá") — hai menu
// không được nói khác nhau về cùng một hồ sơ. "Việc của bạn" ở bước hợp đồng lấy
// `owner_action` của RPC owner_consignment_summary, cùng nguồn với số trên menu.

import { consignmentStageOf, type ConsignmentFacts } from "@/lib/consignment/ownerConsignment";
import type { OwnerAction } from "@/lib/consignment/postingBadge";

export const DIGITIZE_TRACK = ["Số hoá", "Sàn duyệt", "Gửi & báo giá", "Hợp đồng"] as const;

export type DigitizeStage =
  | "draft"
  | "review"
  | "rejected"
  | "ready"
  | "quoting"
  | "resend"
  | "choose"
  | "contract"
  | "signed"
  | "cancelled";

/** me = việc của chủ tài sản · wait = đang chờ bên khác · err = bị trả lại. */
export type DigitizeTone = "draft" | "wait" | "me" | "err" | "ok";

/** Bên đang phải làm bước tiếp theo; null = không còn việc (đã ký / đã huỷ). */
export type DigitizeWho = "owner" | "platform" | "org" | null;

export interface DigitizeFacts extends ConsignmentFacts {
  ownerAction: OwnerAction | null;
}

export interface DigitizeStatus {
  stage: DigitizeStage;
  label: string;
  tone: DigitizeTone;
  /** Số bước ĐÃ xong trên DIGITIZE_TRACK (0–4) — cũng là chỉ số bước hiện tại. */
  step: number;
  who: DigitizeWho;
  ownerAction: OwnerAction | null;
}

const META: Record<DigitizeStage, { label: string; step: number }> = {
  draft: { label: "Nháp", step: 0 },
  review: { label: "Chờ duyệt", step: 1 },
  rejected: { label: "Cần sửa", step: 1 },
  ready: { label: "Sẵn sàng gửi", step: 2 },
  quoting: { label: "Chờ báo giá", step: 2 },
  resend: { label: "Cần gửi thêm", step: 2 },
  choose: { label: "Có báo giá", step: 2 },
  contract: { label: "Lập hợp đồng", step: 3 },
  signed: { label: "Đã ký hợp đồng", step: 4 },
  cancelled: { label: "Đã huỷ", step: 0 },
};

function toneOf(stage: DigitizeStage, who: DigitizeWho): DigitizeTone {
  if (stage === "rejected") return "err";
  if (stage === "signed") return "ok";
  if (stage === "draft" || stage === "cancelled") return "draft";
  return who === "owner" ? "me" : "wait";
}

const CONTRACT_OWNER_ACTIONS: readonly OwnerAction[] = ["confirm_contract", "add_address"];
const WAITING_ON_ORG = ["sent", "seen"];

export function digitizeStatusOf(f: DigitizeFacts): DigitizeStatus {
  const make = (stage: DigitizeStage, who: DigitizeWho): DigitizeStatus => ({
    stage,
    label: META[stage].label,
    step: META[stage].step,
    tone: toneOf(stage, who),
    who,
    ownerAction: f.ownerAction,
  });

  if (f.postingStatus === "draft") return make("draft", "owner");
  if (f.postingStatus === "cancelled") return make("cancelled", null);
  // Bị trả lại chặn mọi thứ phía sau — phải sửa trước đã.
  if (f.reviewStatus === "rejected") return make("rejected", "owner");

  switch (consignmentStageOf(f)) {
    case "da_ky":
      return make("signed", null);
    case "hop_dong":
    case "da_chon":
      return make("contract", f.ownerAction && CONTRACT_OWNER_ACTIONS.includes(f.ownerAction) ? "owner" : "org");
    case "cho_chon":
      return make("choose", "owner");
    case "cho_bao_gia":
      // Còn tổ chức chưa trả lời ⇒ chờ tổ chức; chỉ còn yêu cầu nhờ sàn ⇒ chờ sàn.
      return make("quoting", f.requestStatuses.some((s) => WAITING_ON_ORG.includes(s)) ? "org" : "platform");
    case "het_to_chuc":
      return make("resend", "owner");
    case "chua_gui":
      return make("ready", "owner");
    default:
      // Chưa vào luồng ký gửi: đã duyệt (dữ liệu cũ, status khác active) coi như sẵn sàng.
      return f.reviewStatus === "approved" ? make("ready", "owner") : make("review", "platform");
  }
}

export interface DigitizeNextContext {
  /** % hoàn thiện của bản nháp. */
  pct: number;
  sentCount: number;
  quotedCount: number;
  /** Tổ chức đã chốt, null khi chưa chốt. */
  orgName: string | null;
}

/** Một câu "bước tiếp theo" — dùng chung cho cột danh sách và hộp việc ở chi tiết. */
export function digitizeNextLine(s: DigitizeStatus, c: DigitizeNextContext): string {
  const org = c.orgName ?? "tổ chức đấu giá";
  switch (s.stage) {
    case "draft":
      return `Hoàn thiện ${c.pct}% · tiếp tục số hoá`;
    case "review":
      return "Sàn đang duyệt hồ sơ · 1–2 ngày làm việc";
    case "rejected":
      return "Sửa theo góp ý của sàn";
    case "ready":
      return "Gửi cho tổ chức đấu giá";
    case "quoting":
      return s.who === "platform"
        ? "Sàn đang tìm tổ chức phù hợp giúp bạn"
        : `Đã gửi ${c.sentCount} tổ chức, đang chờ báo giá`;
    case "resend":
      return "Các tổ chức đã gửi đều từ chối · gửi thêm tổ chức khác";
    case "choose":
      return `Chọn 1 trong ${c.quotedCount} báo giá`;
    case "contract":
      if (s.ownerAction === "add_address") return "Bổ sung địa chỉ để lập hợp đồng";
      return s.who === "owner" ? `Xác nhận hợp đồng với ${org}` : `Chờ ${org} hoàn tất hợp đồng`;
    case "signed":
      return `Đã ký gửi cho ${org}`;
    case "cancelled":
      return "Hồ sơ đã huỷ";
  }
}

/** Nhãn nhỏ phía trên câu bước tiếp theo. */
export function digitizeWhoLabel(who: DigitizeWho): string | null {
  switch (who) {
    case "owner":
      return "Việc của bạn";
    case "platform":
      return "Chờ sàn";
    case "org":
      return "Chờ tổ chức";
    default:
      return null;
  }
}

// ─── Nhóm lọc ở danh sách ────────────────────────────────────────────────────

export type DigitizeFilter = "tat-ca" | "can-xu-ly" | "dang-so-hoa" | "dang-ky-gui" | "da-ky";

export const DIGITIZE_FILTERS: { key: DigitizeFilter; label: string }[] = [
  { key: "tat-ca", label: "Tất cả" },
  { key: "can-xu-ly", label: "Cần bạn xử lý" },
  { key: "dang-so-hoa", label: "Đang số hoá" },
  { key: "dang-ky-gui", label: "Đang ký gửi" },
  { key: "da-ky", label: "Đã ký hợp đồng" },
];

const FILTER_STAGES: Record<Exclude<DigitizeFilter, "tat-ca" | "can-xu-ly">, readonly DigitizeStage[]> = {
  "dang-so-hoa": ["draft", "review", "rejected"],
  "dang-ky-gui": ["ready", "quoting", "resend", "choose", "contract"],
  "da-ky": ["signed"],
};

export function matchesDigitizeFilter(filter: DigitizeFilter, s: DigitizeStatus): boolean {
  if (filter === "tat-ca") return true;
  if (filter === "can-xu-ly") return s.who === "owner";
  return FILTER_STAGES[filter].includes(s.stage);
}
