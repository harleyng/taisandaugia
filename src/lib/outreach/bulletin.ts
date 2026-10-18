// Hồ sơ vụ việc → bản tin chung của tab Tiếp thị (design pdg-mk4.js `mkLots` / `mkGet`).
// Thuần — không React, không Supabase.
//
// Mô tả / hiện trạng / pháp lý soạn THEO LÔ (case_file.lots); bản tin chung ghép các
// lô lại ("Lô 1: …"). Tiêu đề nằm ở case_file.headline, rỗng ⇒ tên phiên.

import { caseLot, type CaseFile } from "./caseFile";
import { vnd } from "./format";

type LotPart = "description" | "condition" | "legal_summary";

export interface BulletinLot {
  id: string;
  lot_no: number;
  title: string;
  starting_price: number | null;
  deposit_amount: number | null;
}

export const sortLots = <T extends { lot_no: number }>(lots: T[]) => [...lots].sort((a, b) => a.lot_no - b.lot_no);

export interface Bulletin {
  head: string;
  cover: string;
  description: string;
  condition: string;
  legal_summary: string;
}

export function buildBulletin(cf: CaseFile, session: { title: string; auction_session_items: BulletinLot[] }): Bulletin {
  const lots = sortLots(session.auction_session_items);
  const join = (k: LotPart) =>
    lots
      .map((l) => ({ l, v: caseLot(cf, l.id)[k].trim() }))
      .filter((x) => x.v)
      .map((x) => (lots.length > 1 ? `Tài sản ${x.l.lot_no}: ${x.v}` : x.v))
      .join("\n");
  return {
    head: cf.headline.trim() || session.title,
    cover: cf.cover_url,
    description: join("description"),
    condition: join("condition"),
    legal_summary: join("legal_summary"),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
/** "22/10/2026" theo giờ máy (như các tab khác của trang chi tiết phiên). */
export const viDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const totalStartingPrice = (lots: BulletinLot[]) =>
  lots.length ? vnd(lots.reduce((a, l) => a + (l.starting_price ?? 0), 0)) : "—";
export const totalDeposit = (lots: BulletinLot[]) =>
  lots.length ? vnd(lots.reduce((a, l) => a + (l.deposit_amount ?? 0), 0)) : "—";
