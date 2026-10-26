// Lỗi nghiệp vụ của các RPC luồng kế hoạch đấu giá.
//
// Cùng khuôn với `src/lib/consignment/errors.ts`: RPC trả `{ ok:false, reason }`
// cho thất bại DỰ KIẾN thay vì RAISE, nên Supabase coi đó là THÀNH CÔNG
// (error = null). Mutation nào quên assert thì một lần trình thất bại vẫn hiện
// toast xanh — không có stack trace nào để lần ra.

import { auctionPlanReasonMessage } from "./types";

export class AuctionPlanRpcError extends Error {
  readonly reason: string;
  /** Toàn bộ payload RPC — vd. `items` khi reason = 'items_without_month'. */
  readonly details: Record<string, unknown>;

  constructor(reason: string, details: Record<string, unknown> = {}) {
    super(auctionPlanReasonMessage(reason, details));
    this.name = "AuctionPlanRpcError";
    this.reason = reason;
    this.details = details;
  }
}

/** Ném AuctionPlanRpcError khi RPC trả `{ ok: false }`; im lặng với mọi dữ liệu khác. */
export function assertAuctionPlanRpcOk(data: unknown): void {
  if (data && typeof data === "object" && !Array.isArray(data) && (data as { ok?: unknown }).ok === false) {
    const payload = data as Record<string, unknown>;
    const reason = payload.reason;
    throw new AuctionPlanRpcError(typeof reason === "string" ? reason : "", payload);
  }
}

/**
 * Lỗi Postgres khi GHI thẳng vào `auction_plans` / `auction_plan_items`.
 *
 * Hai cái bẫy đáng câu chữ riêng:
 *  - 42501 "permission denied for table …" — payload chứa cột client không có
 *    GRANT (status, baseline_version, workspace_id của dòng tài sản…). Lỗi nêu
 *    tên BẢNG chứ không nêu cột, nên câu tiếng Việt phải nói hộ.
 *  - P0001 từ trigger khoá trường mốc / chưa gắn đơn vị hành chính — thông báo
 *    của DB đã là tiếng Việt, giữ nguyên.
 */
export function auctionPlanWriteMessage(error: { code?: string; message?: string } | null | undefined): string {
  const code = error?.code;
  const message = error?.message ?? "";
  if (/Chưa gán đơn vị hành chính/i.test(message)) {
    return "Đơn vị lập kế hoạch chưa được gắn đơn vị hành chính. Mở Chi nhánh / AMC để gắn xã, phường cho chi nhánh rồi tạo lại.";
  }
  if (code === "P0001" && message) return message;
  if (code === "23505") return "Đơn vị này đã có kế hoạch năm cho năm đó. Hãy mở kế hoạch đang có, hoặc tạo kế hoạch bổ sung.";
  if (code === "42501") return "Bạn không có quyền ghi dữ liệu này (hoặc ngoài phạm vi chi nhánh được giao).";
  if (code === "23514") return "Dữ liệu không hợp lệ — kiểm tra lại tháng dự kiến (phải trong năm kế hoạch) và tên tài sản.";
  if (code?.startsWith("22")) return "Dữ liệu không đúng định dạng.";
  return "Không lưu được. Vui lòng thử lại.";
}
