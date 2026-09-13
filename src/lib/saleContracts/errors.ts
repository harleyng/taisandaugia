// Lỗi nghiệp vụ của các RPC hợp đồng mua bán tài sản đấu giá.
//
// RPC trả `{ ok: false, reason }` cho thất bại DỰ KIẾN thay vì RAISE, nên
// Supabase coi đó là thành công (error = null). Mọi mutation PHẢI gọi
// assertSaleRpcOk, nếu không một lần huỷ/thu tiền thất bại vẫn hiện toast xanh.
//
// KHÔNG dùng chung với `assertRpcOk` của ký gửi hay `assertBiddingRpcOk` của
// đấu giá: gộp bảng lý do lại thì mọi mã lạ đều rơi về câu chữ chung chung.

import type { SaleCancelKind } from "@/types/auction-sale-contract";
import { formatVnd } from "@/lib/advertising/slug";

export const SALE_REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "Vui lòng đăng nhập để tiếp tục.",
  not_found: "Không tìm thấy hợp đồng, hoặc bạn không có quyền thao tác trên hợp đồng này.",
  not_authorized: "Bạn không có quyền lập hợp đồng mua bán cho phiên này.",

  // Lập hợp đồng
  not_finalized: "Phiên chưa chốt kết quả — chưa lập được hợp đồng mua bán.",
  lot_not_sold: "Lô này không có người trúng đấu giá.",
  lot_defaulted:
    "Lô này đã được ghi nhận là người trúng không thanh toán — không lập hợp đồng mua bán được nữa.",
  already_exists: "Lô này đã có một hợp đồng mua bán đang mở.",
  seller_unresolved:
    "Chưa xác định được bên bán của lô này. Lô ký gửi cần hợp đồng dịch vụ còn hiệu lực; lô tin đăng cần có chủ tài sản trong danh bạ.",
  invalid_payee: "Bên nhận tiền không hợp lệ.",

  // Điều khoản
  invalid_status: "Hợp đồng vừa chuyển sang bước khác. Tải lại trang để xem trạng thái mới nhất.",
  invalid_installment: "Kỳ thanh toán không hợp lệ — số tiền phải là số nguyên dương.",
  installments_mismatch: "Tổng các kỳ thanh toán phải đúng bằng số tiền còn phải trả.",
  payments_exist:
    "Đã có tiền vào sổ cho hợp đồng này — không đổi lịch kỳ hạn được nữa. Hoàn bút toán trước nếu cần sửa.",

  // Tệp & chữ ký
  invalid_path: "Tệp hợp đồng không hợp lệ. Vui lòng tải lại tệp.",
  file_missing: "Chưa tải được tệp lên. Vui lòng thử lại.",
  invalid_side: "Thao tác không hợp lệ với vai của bạn trên hợp đồng này.",
  invalid_signed_date: "Ngày ký không hợp lệ — không được sau hôm nay.",
  document_changed: "Bản đã ký vừa được thay bằng tệp khác. Mở tệp mới rồi xác nhận lại.",
  already_confirmed: "Bạn đã xác nhận rồi.",

  // Tiền
  invalid_amount: "Số tiền không hợp lệ — nhập số nguyên dương.",
  invalid_method: "Hình thức thanh toán không hợp lệ.",
  amount_exceeds_balance: "Số tiền vượt quá số còn phải trả.",
  already_reversed: "Bút toán này đã được hoàn trước đó.",
  invalid_target: "Không hoàn được một bút toán hoàn.",

  // Huỷ & bàn giao
  invalid_kind: "Loại huỷ hợp đồng không hợp lệ.",
  reason_required: "Vui lòng nêu lý do (ít nhất 10 ký tự).",
  already_cancelled: "Hợp đồng đã bị huỷ trước đó.",
  already_completed: "Hợp đồng đã hoàn tất — không huỷ được nữa.",
  cancelled: "Hợp đồng đã huỷ — không thao tác thêm được.",
  invalid_schedule: "Thời điểm bàn giao không hợp lệ.",

  // Backstop của bước 6 (org_confirm_winner_payment)
  sale_contract_exists:
    "Lô này đã có hợp đồng mua bán — trạng thái thanh toán do sổ tiền của hợp đồng quyết định.",
};

const FALLBACK_MESSAGE = "Thao tác không thành công. Vui lòng thử lại.";

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v)
    ? v
    : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))
      ? Number(v)
      : null;

/** Câu chữ có thể giàu hơn nhờ payload — vd. số dư thực tế khi thu quá tay. */
export function saleReasonMessage(
  reason: string | null | undefined,
  details?: Record<string, unknown>,
): string {
  if (reason === "amount_exceeds_balance") {
    const balance = num(details?.balance);
    if (balance !== null) return `Số tiền vượt quá số còn phải trả (${formatVnd(balance)}).`;
  }
  if (reason === "installments_mismatch") {
    const expected = num(details?.expected);
    if (expected !== null)
      return `Tổng các kỳ thanh toán phải đúng bằng ${formatVnd(expected)}.`;
  }
  return (reason && SALE_REASON_MESSAGES[reason]) || FALLBACK_MESSAGE;
}

export class SaleRpcError extends Error {
  readonly reason: string;
  /** Toàn bộ payload RPC — vd. `balance` khi reason = 'amount_exceeds_balance'. */
  readonly details: Record<string, unknown>;

  constructor(reason: string, details: Record<string, unknown> = {}) {
    super(saleReasonMessage(reason, details));
    this.name = "SaleRpcError";
    this.reason = reason;
    this.details = details;
  }
}

/** Ném SaleRpcError khi RPC trả `{ ok: false }`; im lặng với mọi dữ liệu khác. */
export function assertSaleRpcOk(data: unknown): void {
  if (data && typeof data === "object" && !Array.isArray(data) && (data as { ok?: unknown }).ok === false) {
    const payload = data as Record<string, unknown>;
    const reason = payload.reason;
    throw new SaleRpcError(typeof reason === "string" ? reason : "", payload);
  }
}

/** Lớp thứ hai: lỗi Postgres / mạng khi RPC không kịp trả envelope. */
export function saleErrorMessage(err: unknown): string {
  if (err instanceof SaleRpcError) return err.message;
  if (err instanceof Error) {
    const m = err.message || "";
    if (/failed to fetch/i.test(m)) return "Mất kết nối. Kiểm tra mạng rồi thử lại.";
    if (/42501/.test(m)) return "Bạn không có quyền thực hiện thao tác này.";
    if (/23505/.test(m)) return "Dữ liệu đã tồn tại.";
    if (m) return m;
  }
  return FALLBACK_MESSAGE;
}

export const cancelConsequenceOf = (kind: SaleCancelKind): string =>
  kind === "buyer_refused"
    ? "Tiền đặt trước của người trúng đấu giá bị MẤT và lô được ghi nhận là không thanh toán."
    : "Tiền đặt trước của người trúng đấu giá chuyển sang chờ hoàn trả.";
