// Lỗi nghiệp vụ của các RPC ký gửi (báo giá, chốt, hợp đồng).
//
// RPC trả `{ ok: false, reason }` cho những thất bại DỰ KIẾN (hồ sơ đã chốt,
// hợp đồng đã chuyển bước…) thay vì RAISE, để câu chữ tiếng Việt nằm ở UI chứ
// không phải đi parse thông báo lỗi Postgres. Supabase coi đó là thành công
// (error = null) — nên mọi mutation PHẢI gọi assertRpcOk, nếu không một lần
// chốt thất bại vẫn hiện toast xanh.

import { missingPartiesText } from "./contractState";
import type { MissingParty } from "@/types/consignment-contract";

export const CONSIGNMENT_REASON_MESSAGES: Record<string, string> = {
  not_authenticated: "Vui lòng đăng nhập để tiếp tục.",
  not_found: "Không tìm thấy yêu cầu, hoặc bạn không có quyền thao tác trên yêu cầu này.",
  not_quoted: "Tổ chức này chưa gửi báo giá nên chưa chọn được.",
  already_selected: "Hồ sơ này đã chốt một tổ chức đấu giá. Mỗi hồ sơ chỉ chọn được một báo giá.",
  posting_already_selected:
    "Chủ tài sản đã chốt tổ chức khác cho hồ sơ này — không gửi báo giá được nữa.",
  request_closed: "Yêu cầu đã kết thúc, không thao tác thêm được.",

  // Hợp đồng dịch vụ
  no_contract: "Chưa có hợp đồng cho yêu cầu này.",
  invalid_side: "Thao tác không hợp lệ.",
  invalid_status: "Hợp đồng vừa chuyển sang bước khác. Tải lại trang để xem trạng thái mới nhất.",
  invalid_path: "Tệp hợp đồng không hợp lệ. Vui lòng tải lại tệp.",
  file_missing: "Chưa tải được tệp hợp đồng lên. Vui lòng thử lại.",
  invalid_signed_date: "Ngày ký không hợp lệ — không được sau hôm nay.",
  document_changed: "Bản đã ký vừa được thay bằng tệp khác. Mở tệp mới rồi xác nhận lại.",
  party_incomplete: "Chưa đủ thông tin pháp lý để lập hợp đồng.",
  already_signed: "Hợp đồng đã được hai bên xác nhận ký — không huỷ được nữa.",
  already_cancelled: "Hợp đồng đã bị huỷ trước đó.",
  reason_required: "Vui lòng nêu lý do huỷ (ít nhất 10 ký tự).",
  in_auction_session: "Tài sản đang nằm trong một phiên đấu giá — gỡ khỏi phiên trước khi huỷ hợp đồng.",

  // Địa chỉ chủ tài sản
  address_required: "Vui lòng nhập địa chỉ đầy đủ (ít nhất 5 ký tự).",
  kyc_not_found: "Không tìm thấy hồ sơ xác thực chủ tài sản.",
  invalid_kind: "Loại hồ sơ không hợp lệ.",
};

const FALLBACK_MESSAGE = "Thao tác không thành công. Vui lòng thử lại.";

export function consignmentReasonMessage(
  reason: string | null | undefined,
  details?: Record<string, unknown>,
): string {
  if (reason === "party_incomplete" && Array.isArray(details?.missing) && details.missing.length > 0) {
    return `Chưa đủ thông tin để lập hợp đồng: còn thiếu ${missingPartiesText(details.missing as MissingParty[])}.`;
  }
  return (reason && CONSIGNMENT_REASON_MESSAGES[reason]) || FALLBACK_MESSAGE;
}

export class ConsignmentRpcError extends Error {
  readonly reason: string;
  /** Toàn bộ payload RPC — vd. `missing` khi reason = 'party_incomplete'. */
  readonly details: Record<string, unknown>;

  constructor(reason: string, details: Record<string, unknown> = {}) {
    super(consignmentReasonMessage(reason, details));
    this.name = "ConsignmentRpcError";
    this.reason = reason;
    this.details = details;
  }
}

/** Ném ConsignmentRpcError khi RPC trả `{ ok: false }`; im lặng với mọi dữ liệu khác. */
export function assertRpcOk(data: unknown): void {
  if (data && typeof data === "object" && !Array.isArray(data) && (data as { ok?: unknown }).ok === false) {
    const payload = data as Record<string, unknown>;
    const reason = payload.reason;
    throw new ConsignmentRpcError(typeof reason === "string" ? reason : "", payload);
  }
}
