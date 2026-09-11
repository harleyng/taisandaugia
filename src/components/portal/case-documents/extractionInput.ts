import type { ExtractionLot, ExtractionSession } from "@/lib/caseQa/caseExtraction";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import type { AuctionSessionWithItems } from "@/types/auction-session";

/** Phiên + lô trong portal → đầu vào engine trích xuất (lib không import kiểu UI). */
export function toExtractionSession(s: AuctionSessionWithItems): ExtractionSession {
  return {
    code: s.code ?? "",
    title: s.title,
    venue: s.venue,
    province: s.province,
    formatLabel: AUCTION_FORMAT_LABELS[s.auction_format] ?? null,
    registration_start_at: s.registration_start_at,
    registration_end_at: s.registration_end_at,
    viewing_start_at: s.viewing_start_at,
    viewing_end_at: s.viewing_end_at,
    starts_at: s.starts_at,
    dossier_fee: s.dossier_fee,
  };
}

export function toExtractionLots(s: AuctionSessionWithItems): ExtractionLot[] {
  return s.auction_session_items.map((i) => ({
    lot_no: i.lot_no,
    title: i.title,
    starting_price: i.starting_price,
    deposit_amount: i.deposit_amount,
    bid_step: i.bid_step,
  }));
}
