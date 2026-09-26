// Lỗi của luồng thành viên không gian chủ tài sản → câu tiếng Việt cho toast.
//
// Mỗi luồng một từ điển riêng (xem lý do ở src/lib/bidding/errors.ts): dùng lại
// assertRpcOk của ký gửi thì mọi mã ở đây (already_invited, cannot_change_self…)
// đều rơi vào câu fallback.
//
// Các RPC owner_ws_* (migration 20260926140447) trả `{ ok:false, reason }` cho
// thất bại DỰ KIẾN. Supabase coi đó là thành công (error = null) ⇒ mọi mutation
// PHẢI gọi assertOwnerWsRpcOk, nếu không một lời mời hỏng vẫn toast xanh.

export const OWNER_WS_REASON_MESSAGES: Record<string, string> = {
  // Chung
  not_authenticated: "Vui lòng đăng nhập để tiếp tục.",
  forbidden: "Bạn không có quyền quản lý thành viên của không gian này.",
  not_found: "Không tìm thấy thành viên hoặc lời mời — có thể vừa được thay đổi. Tải lại trang để xem mới nhất.",

  // Mời / đổi vai trò / gỡ
  invalid_email: "Email không hợp lệ.",
  invalid_role: "Vai trò không hợp lệ.",
  invalid_scope: "Phạm vi có chi nhánh không còn thuộc không gian này. Vui lòng chọn lại.",
  already_member: "Email này đã là thành viên của không gian.",
  already_invited:
    "Email này đang có lời mời chờ chấp nhận — sao chép lại liên kết ở mục “Lời mời đang chờ”.",
  cannot_change_self: "Bạn không thể tự đổi vai trò của chính mình.",
  cannot_remove_self: "Bạn không thể tự gỡ chính mình khỏi không gian.",
  last_owner: "Không gian phải còn ít nhất một Trưởng đơn vị.",
  not_pending: "Lời mời này đã được dùng hoặc đã bị thu hồi.",

  // Chấp nhận lời mời
  revoked: "Lời mời đã bị thu hồi.",
  expired: "Lời mời đã hết hạn.",
  already_accepted: "Lời mời này đã được sử dụng.",
  locked: "Tài khoản đang bị khoá.",
  email_mismatch: "Email đăng nhập không khớp với email được mời.",
  not_activated: "Bạn cần kích hoạt tài khoản trước khi tham gia.",

  // Liên kết trụ sở ↔ chi nhánh (Phase 14, migration 20260926185917)
  link_forbidden: "Chỉ Trưởng đơn vị mới gửi hoặc trả lời yêu cầu liên kết.",
  link_not_found: "Không tìm thấy yêu cầu liên kết — có thể vừa được thay đổi. Tải lại trang để xem mới nhất.",
  link_self: "Không thể liên kết một Trạm với chính nó.",
  link_parent_not_eligible:
    "Trạm này chưa gắn pháp nhân trong danh bạ, hoặc đang là chi nhánh của trụ sở khác, nên không làm trụ sở được.",
  link_not_a_branch: "Đơn vị này không phải đơn vị con của trụ sở theo danh bạ.",
  link_already_linked: "Trạm chi nhánh này đã liên kết với một trụ sở.",
  link_already_pending: "Đã có yêu cầu liên kết đang chờ chi nhánh trả lời.",
  link_child_has_children: "Trạm này đang là trụ sở của đơn vị khác nên không làm chi nhánh được.",
  link_not_pending: "Yêu cầu này đã được trả lời hoặc đã huỷ.",
  link_not_linked: "Trạm này hiện không liên kết với trụ sở nào.",
};

const FALLBACK_MESSAGE = "Thao tác không thành công. Vui lòng thử lại.";

export function ownerWsReasonMessage(reason: string | null | undefined): string {
  return (reason && OWNER_WS_REASON_MESSAGES[reason]) || FALLBACK_MESSAGE;
}

export class OwnerWsRpcError extends Error {
  readonly reason: string;
  /** Toàn bộ payload RPC — vd. invite_email khi email_mismatch. */
  readonly details: Record<string, unknown>;

  constructor(reason: string, details: Record<string, unknown> = {}) {
    super(ownerWsReasonMessage(reason));
    this.name = "OwnerWsRpcError";
    this.reason = reason;
    this.details = details;
  }
}

/** Ném OwnerWsRpcError khi RPC trả `{ ok:false }`; im lặng với mọi dữ liệu khác. */
export function assertOwnerWsRpcOk(data: unknown): void {
  if (data && typeof data === "object" && !Array.isArray(data) && (data as { ok?: unknown }).ok === false) {
    const payload = data as Record<string, unknown>;
    const reason = payload.reason;
    throw new OwnerWsRpcError(typeof reason === "string" ? reason : "", payload);
  }
}

/**
 * Lỗi tầng Postgres / PostgREST (RLS, mất mạng) — KHÁC với `{ok:false}` ở trên.
 * Ghi thẳng vào claims / chi nhánh khi không đủ vai trò sẽ về 42501.
 */
export function ownerWsErrorMessage(err: unknown): string {
  if (err instanceof OwnerWsRpcError) return err.message;

  const e = (err ?? {}) as { code?: string; message?: string };
  const msg = e.message ?? "";

  if (/row-level security|permission denied|insufficient_privilege|forbidden/i.test(msg) || e.code === "42501") {
    return "Bạn không có quyền thực hiện thao tác này.";
  }
  if (/failed to fetch|networkerror/i.test(msg)) return "Mất kết nối. Vui lòng thử lại.";
  return msg || FALLBACK_MESSAGE;
}
