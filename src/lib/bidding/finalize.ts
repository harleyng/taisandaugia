// Chốt kết quả phiên: lô nào đang chặn, và chốt xong thì tiền đặt trước đi đâu.
//
// VÌ SAO TÍNH Ở CLIENT: org_finalize_session chỉ trả `{ok:false, reason:
// 'lots_not_closed', count}` — một con số. Đấu giá viên cần biết LÔ NÀO và PHẢI
// LÀM GÌ, nên màn điều hành tự dựng danh sách từ trạng thái đã có sẵn trong bộ
// nhớ và tắt nút trước khi bấm, thay vì để server từ chối rồi đoán.
//
// ĐIỂM DỄ SAI: lọc theo lotPhaseOf(), KHÔNG theo state.status. Một dòng 'open'
// đã quá ends_at vẫn ghi 'open' trong DB cho tới khi pg_cron chạy, nhưng
// org_finalize_session tự đóng lười đúng tập đó TRƯỚC khi đếm
// (20260913000001:1169-1174) ⇒ dùng status thô sẽ báo chặn một lô mà server sẵn
// sàng chốt.

import { lotPhaseOf } from "./lotPhase";
import type { LotState } from "@/types/auction-bidding";

export type FinalizeBlockPhase = "pending" | "open" | "extended" | "paused";

export interface FinalizeBlocker {
  lotId: string;
  lotNo: number;
  title: string;
  phase: FinalizeBlockPhase;
  /** Việc cần làm để lô hết chặn — server không nói, màn hình phải nói. */
  advice: string;
}

const ADVICE: Record<FinalizeBlockPhase, string> = {
  pending: "Mở lô rồi chờ đóng, hoặc rút lô khỏi phiên.",
  open: "Chờ lô đóng hoặc rút lô khỏi phiên.",
  extended: "Chờ lô đóng hoặc rút lô khỏi phiên.",
  paused: "Tiếp tục lô rồi chờ đóng, hoặc rút lô khỏi phiên.",
};

interface FinalizeLot {
  id: string;
  lot_no: number;
  title: string;
}

/** Lô chưa `closed` / `withdrawn` theo giai đoạn dẫn xuất, xếp theo số lô. */
export function finalizeBlockersOf(
  lots: FinalizeLot[],
  stateByLot: Map<string, LotState>,
  now: Date = new Date(),
): FinalizeBlocker[] {
  const out: FinalizeBlocker[] = [];
  for (const lot of lots) {
    const phase = lotPhaseOf(stateByLot.get(lot.id) ?? null, now);
    if (phase === "closed" || phase === "withdrawn") continue;
    out.push({ lotId: lot.id, lotNo: lot.lot_no, title: lot.title, phase, advice: ADVICE[phase] });
  }
  return out.sort((a, b) => a.lotNo - b.lotNo);
}

export interface FinalizePreview {
  sold: number;
  unsold: number;
  withdrawn: number;
  /** Hồ sơ sẽ chuyển tiền đặt trước thành tiền mua tài sản. */
  applied: number;
  /** Hồ sơ sẽ sang "chờ hoàn trả". */
  pendingRefund: number;
}

interface FinalizeContract {
  id: string;
  status: string;
  deposit_status: string;
}

/**
 * Soi gương org_finalize_session (20260913000001:1177-1218):
 *   • sold / unsold đọc từ `result`, withdrawn đọc từ `status` ⇒ lô đã rút KHÔNG
 *     nằm trong sold lẫn unsold, tổng ba số có thể nhỏ hơn số lô.
 *   • chỉ hồ sơ status='paid' AND deposit_status='received' bị đụng tới; hồ sơ
 *     đã tịch thu giữ nguyên, nên không vào applied lẫn pendingRefund.
 *   • trúng nhiều lô vẫn chỉ là MỘT hồ sơ applied.
 * Đếm trên trạng thái HIỆN TẠI: lô 'open' quá giờ đã là `closed` với result sẵn
 * có, đúng cái server sẽ thấy sau bước đóng lười.
 */
export function finalizePreviewOf(
  lots: FinalizeLot[],
  stateByLot: Map<string, LotState>,
  contracts: FinalizeContract[],
  now: Date = new Date(),
): FinalizePreview {
  let sold = 0;
  let unsold = 0;
  let withdrawn = 0;
  const winners = new Set<string>();

  for (const lot of lots) {
    const state = stateByLot.get(lot.id) ?? null;
    const phase = lotPhaseOf(state, now);
    if (phase === "withdrawn") {
      withdrawn += 1;
      continue;
    }
    if (!state) continue;
    if (state.result === "sold") {
      sold += 1;
      if (state.winner_contract_id) winners.add(state.winner_contract_id);
    } else if (state.result === "unsold") {
      unsold += 1;
    }
  }

  let applied = 0;
  let pendingRefund = 0;
  for (const c of contracts) {
    if (c.status !== "paid" || c.deposit_status !== "received") continue;
    if (winners.has(c.id)) applied += 1;
    else pendingRefund += 1;
  }

  return { sold, unsold, withdrawn, applied, pendingRefund };
}
