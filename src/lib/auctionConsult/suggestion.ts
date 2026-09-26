// Dùng đề xuất tư vấn làm dữ liệu GỢI Ý khi lập phiên (BR-CNS-04/06): không gì tự điền —
// tổ chức bấm "Áp dụng" từng trường. Chỉ 3 trường tiền của lô áp dụng được; giá bảo lưu
// và phương thức không bao giờ ghi vào auction_session_items (bảng công khai).

import { DURATION_PRESETS, isValidDurationMinutes } from "@/lib/bidding/controlAccess";
import { depositVnd } from "@/lib/auctionConsult/proposal";
import type { AuctionConsultSuggestion } from "@/types/auctionConsult";

export const LOT_APPLICABLE_FIELDS = ["starting_price", "deposit_amount", "bid_step"] as const;
export type LotApplicableField = (typeof LOT_APPLICABLE_FIELDS)[number];

/**
 * Giá trị gợi ý cho một trường tiền của lô. Tiền đặt trước theo % tính trên giá khởi điểm
 * HIỆN TẠI của form (không phải giá đề xuất) — thiếu giá thì null.
 */
export function suggestedLotValue(
  field: LotApplicableField,
  s: Pick<AuctionConsultSuggestion, "starting_price" | "bid_step" | "deposit_mode" | "deposit_value">,
  currentStartingPrice: number | null,
): number | null {
  switch (field) {
    case "starting_price":
      return s.starting_price == null ? null : Number(s.starting_price);
    case "bid_step":
      return s.bid_step == null ? null : Number(s.bid_step);
    case "deposit_amount":
      return depositVnd(s.deposit_mode, s.deposit_value == null ? null : Number(s.deposit_value), currentStartingPrice);
  }
}

export function suggestionsByPosting(rows: AuctionConsultSuggestion[]): Map<string, AuctionConsultSuggestion> {
  return new Map(rows.map((r) => [r.asset_posting_id, r]));
}

/** Lô có đề xuất khác hình thức của phiên — chỉ để cảnh báo, không đổi phiên. */
export function formatMismatches(
  sessionFormat: string | null | undefined,
  items: { asset_posting_id: string | null; title: string }[],
  map: Map<string, AuctionConsultSuggestion>,
): { title: string; version: number; format: string }[] {
  if (!sessionFormat) return [];
  const out: { title: string; version: number; format: string }[] = [];
  for (const it of items) {
    const s = it.asset_posting_id ? map.get(it.asset_posting_id) : undefined;
    if (s?.auction_format && s.auction_format !== sessionFormat)
      out.push({ title: it.title, version: s.version, format: s.auction_format });
  }
  return out;
}

export type DurationChoice = { choice: string; custom?: string };

/** Quy thời lượng đề xuất sang lựa chọn của hộp thoại "Mở lô" (preset hoặc tuỳ chỉnh). */
export function durationChoice(minutes: number | null | undefined, customKey = "custom"): DurationChoice | null {
  if (minutes == null || !isValidDurationMinutes(minutes)) return null;
  if ((DURATION_PRESETS as readonly number[]).includes(minutes)) return { choice: String(minutes) };
  return { choice: customKey, custom: String(minutes) };
}
