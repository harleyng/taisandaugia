// HỒ SƠ VỤ VIỆC của gói tiếp thị — phần tổ chức tự khai, lưu ở
// session_outreach_packs.case_file. Dữ kiện phiên / lô (giờ, giá, tỉnh…) KHÔNG
// chép vào đây: đọc thẳng từ auction_sessions / auction_session_items để không lệch.

import { z } from "zod";
import type { CaseSlotKey } from "./noticeTemplate";

const text = z.string().max(4000).catch("");

export const caseLotSchema = z.object({
  description: text,
  condition: text,
  legal_summary: text,
  photo_urls: z.array(z.string().url()).max(12).catch([]),
});

export const caseFileSchema = z.object({
  owner_info: text,
  asset_location: text,
  ownership_papers: text,
  viewing_place: text,
  registration_place: text,
  registration_conditions: text,
  auction_method: text,
  contact_person: text,
  /** Bổ sung theo lô, khoá = auction_session_items.id. Lô đã gỡ khỏi phiên bị bỏ qua. */
  lots: z.record(z.string(), caseLotSchema).catch({}),
});

export type CaseLot = z.infer<typeof caseLotSchema>;
export type CaseFile = z.infer<typeof caseFileSchema>;

export const EMPTY_CASE_LOT: CaseLot = { description: "", condition: "", legal_summary: "", photo_urls: [] };

/** Dữ liệu jsonb bất kỳ → CaseFile hợp lệ (trường hỏng rơi về rỗng, không ném lỗi). */
export function parseCaseFile(raw: unknown): CaseFile {
  const obj = raw && typeof raw === "object" ? raw : {};
  return caseFileSchema.parse(obj);
}

export const caseLot = (cf: CaseFile, itemId: string): CaseLot => ({ ...EMPTY_CASE_LOT, ...(cf.lots[itemId] ?? {}) });

export const caseSlotValues = (cf: CaseFile): Record<CaseSlotKey, string> => ({
  owner_info: cf.owner_info,
  asset_location: cf.asset_location,
  ownership_papers: cf.ownership_papers,
  viewing_place: cf.viewing_place,
  registration_place: cf.registration_place,
  registration_conditions: cf.registration_conditions,
  auction_method: cf.auction_method,
  contact_person: cf.contact_person,
});

// ─── Điền sẵn từ nguồn của lô ────────────────────────────────────────────────

export interface ListingSource {
  id: string;
  description: string | null;
  legal_status: string | null;
  image_url: string | null;
}

export interface ConsignmentSource {
  posting_id: string;
  description: string | null;
  image_urls: string[] | null;
  has_dispute: boolean | null;
  has_mortgage: boolean | null;
  is_seized: boolean | null;
}

export interface PrefillLot {
  id: string;
  listing_id: string | null;
  asset_posting_id: string | null;
  image_url: string | null;
}

/** Cờ pháp lý chủ tài sản đã khai → câu tóm tắt. Cờ NULL (chưa khai) thì bỏ qua. */
export function legalSummaryFromFlags(c: Pick<ConsignmentSource, "has_dispute" | "has_mortgage" | "is_seized">): string {
  const out: string[] = [];
  if (c.has_dispute != null) out.push(c.has_dispute ? "đang có tranh chấp" : "không có tranh chấp");
  if (c.has_mortgage != null) out.push(c.has_mortgage ? "đang thế chấp" : "không thế chấp");
  if (c.is_seized != null) out.push(c.is_seized ? "đang bị kê biên" : "không bị kê biên");
  if (!out.length) return "";
  const s = `Theo khai báo của chủ tài sản: ${out.join(", ")}.`;
  return s;
}

/**
 * Điền các ô CÒN TRỐNG của từng lô từ tin đăng / hồ sơ ký gửi nguồn. Không bao giờ
 * ghi đè thứ tổ chức đã nhập.
 */
export function prefillCaseFile(
  cf: CaseFile,
  lots: PrefillLot[],
  listings: ListingSource[],
  consignments: ConsignmentSource[],
): CaseFile {
  const listingById = new Map(listings.map((l) => [l.id, l]));
  const postingById = new Map(consignments.map((c) => [c.posting_id, c]));
  const next: CaseFile = { ...cf, lots: { ...cf.lots } };

  for (const lot of lots) {
    const cur = caseLot(cf, lot.id);
    const listing = lot.listing_id ? listingById.get(lot.listing_id) : undefined;
    const posting = lot.asset_posting_id ? postingById.get(lot.asset_posting_id) : undefined;
    const photos = [
      ...(lot.image_url ? [lot.image_url] : []),
      ...(listing?.image_url ? [listing.image_url] : []),
      ...(posting?.image_urls ?? []),
    ];
    next.lots[lot.id] = {
      description: cur.description || (listing?.description ?? posting?.description ?? "").trim(),
      condition: cur.condition,
      legal_summary: cur.legal_summary || (listing?.legal_status ?? "").trim() || (posting ? legalSummaryFromFlags(posting) : ""),
      photo_urls: cur.photo_urls.length ? cur.photo_urls : [...new Set(photos)].slice(0, 12),
    };
  }
  return next;
}
