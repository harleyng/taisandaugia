// Dữ liệu vào của biên bản đấu giá: thuần, không Supabase, không pdfmake.
//
// QUYỀN RIÊNG TƯ — RÀNG BUỘC CỨNG: biên bản được RLS cho ANON đọc ngay khi phiên
// chốt kết quả (auction_session_minutes_public_read, 20260913000001:507). Vì vậy
// buildMinutesPdfInput() chỉ lấy HỌ TÊN + SỐ BÁO DANH của người trúng và HỌ TÊN +
// SỐ THẺ của đấu giá viên. Không CCCD, không địa chỉ, không điện thoại — dù cả
// hai nguồn dữ liệu đều có sẵn các cột đó. Quyết định 2026-09-12.

import type { AuctionFormat } from "@/types/asset-posting";
import type { LotResult, LotState } from "@/types/auction-bidding";

export const MINUTES_BUCKET = "auction-minutes";

export interface MinutesLotRow {
  lotNo: number;
  title: string;
  startingPrice: number | null;
  bidStep: number | null;
  bidCount: number;
  result: LotResult | null;
  withdrawn: boolean;
  withdrawReason: string | null;
  winningAmount: number | null;
  winnerName: string | null;
  winnerBidderNo: number | null;
  closedAt: string | null;
  paymentDueAt: string | null;
}

export interface MinutesSession {
  id: string;
  code: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  venue: string | null;
  province: string | null;
  auctionFormat: AuctionFormat;
  extensionSeconds: number;
  maxBidSteps: number;
  finalizedAt: string | null;
}

export interface MinutesOrg {
  name: string;
  address: string | null;
  phone: string | null;
}

/** Chỉ hai trường — xem ràng buộc quyền riêng tư ở đầu file. */
export interface MinutesAuctioneer {
  fullName: string;
  licenseNumber: string | null;
}

export interface MinutesPdfInput {
  session: MinutesSession;
  org: MinutesOrg;
  auctioneer: MinutesAuctioneer | null;
  lots: MinutesLotRow[];
  /** Hồ sơ đã thanh toán. */
  dossierCount: number;
  /** Hồ sơ đã được cấp số báo danh. */
  bidderNoCount: number;
  generatedAt: Date;
}

interface SourceLot {
  id: string;
  lot_no: number;
  title: string;
  starting_price: number | null;
  bid_step: number | null;
}

interface SourceContract {
  id: string;
  status: string;
  full_name: string;
  bidder_no: number | null;
}

export interface BuildMinutesArgs {
  session: MinutesSession;
  org: MinutesOrg;
  auctioneer: MinutesAuctioneer | null;
  lots: SourceLot[];
  stateByLot: Map<string, LotState>;
  contracts: SourceContract[];
  now?: Date;
}

export function buildMinutesPdfInput(args: BuildMinutesArgs): MinutesPdfInput {
  const { session, org, auctioneer, lots, stateByLot, contracts } = args;
  if (!session.finalizedAt) {
    throw new Error("Phiên chưa chốt kết quả — chưa lập được biên bản đấu giá.");
  }

  const paid = contracts.filter((c) => c.status === "paid");
  const nameById = new Map(paid.map((c) => [c.id, c.full_name]));
  const bidderNoById = new Map(paid.map((c) => [c.id, c.bidder_no]));

  const rows: MinutesLotRow[] = [...lots]
    .sort((a, b) => a.lot_no - b.lot_no)
    .map((lot): MinutesLotRow => {
      const st = stateByLot.get(lot.id) ?? null;
      const winnerId = st?.result === "sold" ? st.winner_contract_id : null;
      return {
        lotNo: lot.lot_no,
        title: lot.title,
        startingPrice: lot.starting_price,
        bidStep: lot.bid_step,
        bidCount: st?.bid_count ?? 0,
        result: st?.result ?? null,
        withdrawn: st?.status === "withdrawn",
        withdrawReason: st?.withdraw_reason ?? null,
        winningAmount: st?.result === "sold" ? st.winning_amount : null,
        // CHỈ tên + số báo danh. Không bao giờ tra thêm cột nào khác của hồ sơ.
        winnerName: winnerId ? nameById.get(winnerId) ?? null : null,
        winnerBidderNo: winnerId ? bidderNoById.get(winnerId) ?? null : null,
        closedAt: st?.closed_at ?? null,
        paymentDueAt: st?.payment_due_at ?? null,
      };
    });

  return {
    session,
    org,
    auctioneer,
    lots: rows,
    dossierCount: paid.length,
    bidderNoCount: paid.filter((c) => c.bidder_no != null).length,
    generatedAt: args.now ?? new Date(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Tên tệp biên bản.
 *
 * PHẢI khớp `^[A-Za-z0-9._-]+\.pdf$` — org_issue_minutes kiểm đoạn thứ ba của
 * đường dẫn bằng đúng regex này (20260913000001:1249) nên không dấu, không
 * khoảng trắng, và TUYỆT ĐỐI không nhét tiêu đề tài sản vào.
 *
 * `code` là `string | null` trong types nên phải có đường lùi: thiếu nó mà cứ nội
 * suy thì ra "bien-ban_null_….pdf" — vẫn khớp regex, vẫn tải lên được, và sai
 * tên vĩnh viễn vì tệp không xoá được.
 *
 * Dấu thời gian + 8 ký tự đầu của hash làm tên duy nhất: biên bản lần 2 phải có
 * đường dẫn khác lần 1 (pdf_path là UNIQUE).
 */
export function minutesFileName(
  code: string | null,
  sessionId: string,
  contentHash: string,
  at: Date,
): string {
  const safeCode = (code ?? "").replace(/[^A-Za-z0-9-]/g, "") || sessionId.slice(0, 8);
  const stamp =
    `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}` +
    `${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `bien-ban_${safeCode}_${stamp}_${contentHash.slice(0, 8)}.pdf`;
}

/** `{orgId}/{sessionId}/{tên}.pdf` — đúng 3 đoạn mà RPC tách bằng split_part. */
export function minutesObjectPath(orgId: string, sessionId: string, fileName: string): string {
  return `${orgId}/${sessionId}/${fileName}`;
}
