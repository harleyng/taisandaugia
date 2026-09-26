// Phương án tư vấn đấu giá: kiểm hợp lệ (bản TS của _auction_consult_write_proposal trong
// migration 20260915000040 — sửa luật thì sửa cả hai), quy đổi nháp ⇄ JSON gửi RPC.

import { depositFromPlan } from "@/lib/auctionSessions/deposit";
import { DEPOSIT_LEGAL_RANGE } from "@/constants/quote-plan";
import { DEFAULT_DURATION_MINUTES } from "@/lib/bidding/controlAccess";
import { PROPOSAL_NOTE_KEYS } from "@/lib/auctionConsult/labels";
import type {
  AuctionConsultation,
  AuctionConsultProposal,
  ConsultDepositMode,
  ProposalDraft,
  ProposalNoteKey,
} from "@/types/auctionConsult";

const FORMATS = ["truc_tiep", "truc_tuyen", "ca_hai"];
const METHODS = ["ascending", "descending", "sealed"];

/** "" ⇒ null; chuỗi không phải số ⇒ NaN (để báo lỗi thay vì lặng lẽ bỏ). */
export function toNum(s: string | number | null | undefined): number | null {
  if (s == null) return null;
  const t = String(s).trim();
  if (t === "") return null;
  return Number(t);
}

const isPosInt = (n: number) => Number.isFinite(n) && n > 0 && Number.isInteger(n);

export interface ProposalValues {
  auction_format: string | null;
  bidding_method: string | null;
  starting_price: number | null;
  reserve_price: number | null;
  bid_step: number | null;
  lot_duration_minutes: number | null;
  deposit_mode: ConsultDepositMode | null;
  deposit_value: number | null;
  rationale: string | null;
  field_notes: Partial<Record<ProposalNoteKey, string>>;
}

export function draftToValues(d: ProposalDraft): ProposalValues {
  const depositValue = toNum(d.deposit_value);
  const notes: Partial<Record<ProposalNoteKey, string>> = {};
  for (const k of PROPOSAL_NOTE_KEYS) {
    const v = d.field_notes[k]?.trim();
    if (v) notes[k] = v;
  }
  return {
    auction_format: d.auction_format || null,
    bidding_method: d.bidding_method || null,
    starting_price: toNum(d.starting_price),
    reserve_price: toNum(d.reserve_price),
    bid_step: toNum(d.bid_step),
    lot_duration_minutes: d.auction_format === "truc_tiep" ? null : toNum(d.lot_duration_minutes),
    deposit_mode: depositValue == null ? null : d.deposit_mode,
    deposit_value: depositValue,
    rationale: d.rationale.trim() || null,
    field_notes: notes,
  };
}

/** Mã lỗi đầu tiên (cùng mã với server) hoặc null. strict = lúc hoàn tất. */
export function validateProposal(v: ProposalValues, strict: boolean): string | null {
  if (v.auction_format && !FORMATS.includes(v.auction_format)) return "format_invalid";
  if (v.bidding_method && !METHODS.includes(v.bidding_method)) return "method_invalid";
  if (v.starting_price != null && !isPosInt(v.starting_price)) return "starting_price_invalid";
  if (v.reserve_price != null && !isPosInt(v.reserve_price)) return "reserve_invalid";
  if (v.reserve_price != null && v.starting_price != null) {
    if (v.bidding_method === "ascending" && v.reserve_price < v.starting_price) return "reserve_invalid";
    if (v.bidding_method === "descending" && v.reserve_price > v.starting_price) return "reserve_invalid";
  }
  if (v.bid_step != null && (!isPosInt(v.bid_step) || (v.starting_price != null && v.bid_step > v.starting_price)))
    return "bid_step_invalid";
  if (
    v.lot_duration_minutes != null &&
    (!Number.isInteger(v.lot_duration_minutes) || v.lot_duration_minutes < 1 || v.lot_duration_minutes > 1440)
  )
    return "duration_invalid";
  if (v.deposit_mode != null && v.deposit_mode !== "percent" && v.deposit_mode !== "amount") return "deposit_mode_invalid";
  if ((v.deposit_mode == null) !== (v.deposit_value == null)) return "deposit_value_invalid";
  if (v.deposit_mode === "percent") {
    const d = v.deposit_value!;
    if (!Number.isFinite(d) || d <= 0 || d > 100 || Math.round(d * 100) !== d * 100) return "deposit_value_invalid";
  }
  if (v.deposit_mode === "amount") {
    if (!isPosInt(v.deposit_value!)) return "deposit_value_invalid";
    if (v.starting_price != null && v.deposit_value! > v.starting_price) return "deposit_above_price";
  }
  for (const [k, note] of Object.entries(v.field_notes)) {
    if (!PROPOSAL_NOTE_KEYS.includes(k as ProposalNoteKey) || typeof note !== "string" || note.length > 1000)
      return "field_notes_invalid";
  }
  if (v.rationale && v.rationale.length > 4000) return "rationale_too_long";

  if (strict) {
    if (!v.auction_format) return "format_required";
    if (!v.bidding_method) return "method_required";
    if (v.starting_price == null) return "starting_price_required";
    if (v.bid_step == null) return "bid_step_required";
    if (v.deposit_mode == null) return "deposit_required";
    if (v.auction_format !== "truc_tiep" && v.lot_duration_minutes == null) return "duration_required";
    if (!v.rationale || v.rationale.length < 5) return "rationale_required";
  }
  return null;
}

/** Tiền đặt trước quy ra VNĐ (% cần giá khởi điểm). */
export const depositVnd = (
  mode: string | null | undefined,
  value: number | null | undefined,
  startingPrice: number | null | undefined,
) => (mode ? depositFromPlan(mode as ConsultDepositMode, value, startingPrice) : null);

/** Cảnh báo (không chặn) khi tiền đặt trước ngoài khoảng 5–20% giá khởi điểm theo Luật Đấu giá tài sản. */
export function depositWarning(
  mode: string | null | undefined,
  value: number | null | undefined,
  startingPrice: number | null | undefined,
): string | null {
  if (value == null || !startingPrice) return null;
  const pct = mode === "percent" ? value : (value / startingPrice) * 100;
  if (!Number.isFinite(pct)) return null;
  if (pct < DEPOSIT_LEGAL_RANGE.min || pct > DEPOSIT_LEGAL_RANGE.max)
    return `Ngoài khoảng ${DEPOSIT_LEGAL_RANGE.min}–${DEPOSIT_LEGAL_RANGE.max}% giá khởi điểm theo Luật Đấu giá tài sản.`;
  return null;
}

/** Bước giá so với giá khởi điểm, làm tròn 2 chữ số (%). */
export function bidStepPercent(step: number | null | undefined, start: number | null | undefined): number | null {
  if (!step || !start) return null;
  return Math.round((step / start) * 10_000) / 100;
}

const str = (n: number | null | undefined) => (n == null ? "" : String(Number(n)));

/** Nạp nháp đã lưu; chưa có thì gợi ý từ bản chụp hồ sơ lúc yêu cầu. */
export function proposalToDraft(
  p: AuctionConsultProposal | null | undefined,
  c: Pick<AuctionConsultation, "posting_auction_format" | "posting_starting_price" | "expected_price">,
): ProposalDraft {
  if (p) {
    return {
      auction_format: p.auction_format ?? "",
      bidding_method: p.bidding_method ?? "",
      starting_price: str(p.starting_price),
      reserve_price: str(p.reserve_price),
      bid_step: str(p.bid_step),
      lot_duration_minutes: str(p.lot_duration_minutes),
      deposit_mode: (p.deposit_mode as ConsultDepositMode) ?? "percent",
      deposit_value: str(p.deposit_value),
      rationale: p.rationale ?? "",
      field_notes: (p.field_notes ?? {}) as Partial<Record<ProposalNoteKey, string>>,
    };
  }
  return {
    auction_format: c.posting_auction_format ?? "",
    bidding_method: "ascending",
    starting_price: str(c.posting_starting_price ?? c.expected_price),
    reserve_price: "",
    bid_step: "",
    lot_duration_minutes: String(DEFAULT_DURATION_MINUTES),
    deposit_mode: "percent",
    deposit_value: "10",
    rationale: "",
    field_notes: {},
  };
}
