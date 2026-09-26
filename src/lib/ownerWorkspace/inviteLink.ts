// Liên kết mời vào không gian chủ tài sản. Tách khỏi /loi-moi/:token của tổ chức
// đấu giá: token không mang loại lời mời, và trang kia gắn chặt RPC/luồng của tổ chức.

export const OWNER_INVITE_PATH = "/loi-moi-chu-tai-san";

export function ownerInviteLink(token: string, origin: string = window.location.origin): string {
  return `${origin}${OWNER_INVITE_PATH}/${token}`;
}
