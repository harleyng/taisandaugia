// Đầu vào của trình soạn tiếp thị + các dữ kiện (fact) của thông báo đấu giá.
// Thuần — không React, không Supabase.

import { categoryLabel } from "@/lib/orgContacts/interestLabel";
import { caseLot, type CaseFile } from "./caseFile";
import type { SegmentKey } from "./fieldKeys";
import { fnv1aHex } from "./hash";
import { viDateTime, viRange, vnd } from "./format";
import type { FactSlotKey } from "./noticeTemplate";

export interface OutreachOrg {
  name: string;
  address: string | null;
  phone: string | null;
}

export interface OutreachLot {
  id: string;
  lot_no: number;
  title: string;
  category_slug: string | null;
  province: string | null;
  district: string | null;
  starting_price: number | null;
  deposit_amount: number | null;
  bid_step: number | null;
}

export interface OutreachSession {
  id: string;
  code: string | null;
  title: string;
  auction_format: string;
  venue: string | null;
  province: string | null;
  registration_start_at: string | null;
  registration_end_at: string | null;
  viewing_start_at: string | null;
  viewing_end_at: string | null;
  starts_at: string;
  ends_at: string;
  dossier_fee: number | null;
}

export interface OutreachInput {
  session: OutreachSession;
  org: OutreachOrg;
  lots: OutreachLot[];
  caseFile: CaseFile;
  publicUrl: string;
  /** Phân khúc cần câu chào — lấy từ org_session_audience. */
  segments: SegmentKey[];
}

export const AUCTION_FORMAT_TEXT: Record<string, string> = {
  truc_tiep: "Đấu giá trực tiếp tại cuộc đấu giá",
  truc_tuyen: "Đấu giá trực tuyến",
  ca_hai: "Đấu giá trực tiếp kết hợp trực tuyến",
};

export const sortedLots = (lots: OutreachLot[]) => [...lots].sort((a, b) => a.lot_no - b.lot_no);

export const lotPlace = (l: Pick<OutreachLot, "district" | "province">) =>
  [l.district, l.province].filter(Boolean).join(", ");

/** Một dòng / lô cho các mục giá: "Lô 1: 12,500,000,000₫". Lô thiếu số ⇒ ghi rõ. */
function perLot(lots: OutreachLot[], pickValue: (l: OutreachLot) => number | null, missing: string): string {
  return sortedLots(lots)
    .map((l) => `Lô ${l.lot_no}: ${pickValue(l) != null ? vnd(pickValue(l)) : missing}`)
    .join("\n");
}

export function buildNoticeFacts(input: OutreachInput): Record<FactSlotKey, string> {
  const { session: s, org, lots } = input;
  return {
    org_name: org.name,
    org_address: org.address ?? "",
    org_phone: org.phone ? `Điện thoại: ${org.phone}` : "",
    lots_list: sortedLots(lots)
      .map((l) => {
        const kind = l.category_slug ? ` (${categoryLabel(l.category_slug)})` : "";
        const place = lotPlace(l);
        return `Lô ${l.lot_no}: ${l.title}${kind}${place ? ` — ${place}` : ""}`;
      })
      .join("\n"),
    starting_prices: perLot(lots, (l) => l.starting_price, "chưa công bố"),
    deposits: perLot(lots, (l) => l.deposit_amount, "theo hồ sơ tham gia đấu giá"),
    bid_steps: lots.some((l) => l.bid_step != null) ? perLot(lots, (l) => l.bid_step, "theo quy chế cuộc đấu giá") : "",
    viewing_time: viRange(s.viewing_start_at, s.viewing_end_at),
    registration_time: viRange(s.registration_start_at, s.registration_end_at),
    dossier_fee: s.dossier_fee != null ? `${vnd(s.dossier_fee)} / bộ hồ sơ` : "",
    auction_time: viDateTime(s.starts_at),
    auction_venue: s.venue ?? "",
    auction_format: AUCTION_FORMAT_TEXT[s.auction_format] ?? "",
    public_url: input.publicUrl,
  };
}

export interface SessionLike {
  id: string;
  code: string | null;
  title: string;
  auction_format: string;
  venue: string | null;
  province: string | null;
  registration_start_at: string | null;
  registration_end_at: string | null;
  viewing_start_at: string | null;
  viewing_end_at: string | null;
  starts_at: string;
  ends_at: string;
  dossier_fee?: number | null;
  auction_session_items: OutreachLot[];
}

/** Phiên + gói + người nhận → đầu vào trình soạn. Phân khúc lấy từ khách ĐỦ điều kiện. */
export function inputFromSession(
  session: SessionLike,
  org: OutreachOrg,
  caseFile: CaseFile,
  audience: { eligible: boolean; segment_key: string }[],
  publicUrl: string,
): OutreachInput {
  const segments = [...new Set(audience.filter((a) => a.eligible).map((a) => a.segment_key))].sort() as SegmentKey[];
  return {
    session: {
      id: session.id,
      code: session.code,
      title: session.title,
      auction_format: session.auction_format,
      venue: session.venue,
      province: session.province,
      registration_start_at: session.registration_start_at,
      registration_end_at: session.registration_end_at,
      viewing_start_at: session.viewing_start_at,
      viewing_end_at: session.viewing_end_at,
      starts_at: session.starts_at,
      ends_at: session.ends_at,
      dossier_fee: session.dossier_fee ?? null,
    },
    org,
    lots: session.auction_session_items.map((l) => ({
      id: l.id,
      lot_no: l.lot_no,
      title: l.title,
      category_slug: l.category_slug,
      province: l.province,
      district: l.district,
      starting_price: l.starting_price,
      deposit_amount: l.deposit_amount,
      bid_step: l.bid_step,
    })),
    caseFile,
    publicUrl,
    segments,
  };
}

/**
 * Chữ ký của MỌI thứ trình soạn đọc. Lưu vào gói khi sinh; khác chữ ký hiện tại ⇒
 * bản nháp đã cũ so với phiên / hồ sơ vụ việc.
 */
export function outreachSignature(input: OutreachInput): string {
  const lots = sortedLots(input.lots).map((l) => ({ ...l, extra: caseLot(input.caseFile, l.id) }));
  const { lots: _lotExtras, ...caseTop } = input.caseFile;
  return fnv1aHex(
    JSON.stringify({
      session: input.session,
      org: input.org,
      lots,
      caseTop,
      url: input.publicUrl,
      segments: [...input.segments].sort(),
    }),
  );
}
