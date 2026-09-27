import { createContext, useContext } from "react";

/**
 * Người đang xem làm được gì trên hồ sơ số hoá đang mở (Phase 4 — hồ sơ thuộc không
 * gian; từ migration 20260927170100 quyền theo module của vai trò + phạm vi chi nhánh):
 *   • edit          — sửa hồ sơ + dịch vụ gắn thêm (so-hoa:update)
 *   • consign       — chọn báo giá, huỷ yêu cầu, xác nhận / tải hợp đồng dịch vụ (ky-gui:update)
 *   • consignCreate — gửi yêu cầu báo giá tới tổ chức / nhờ sàn chọn giúp (ky-gui:create)
 * Chỉ để ẨN nút; RLS + RPC (owner_posting_can) mới là cổng thật.
 *
 * Mặc định cho phép hết: các khối dùng chung với wizard (3D, VR, giám định…) nằm
 * ngoài trang chi tiết thì wizard tự quyết định (xem canConsign trong wizard).
 */
export interface PostingAccess {
  edit: boolean;
  consign: boolean;
  consignCreate: boolean;
}

const FULL_ACCESS: PostingAccess = { edit: true, consign: true, consignCreate: true };
export const NO_POSTING_ACCESS: PostingAccess = { edit: false, consign: false, consignCreate: false };

const PostingAccessContext = createContext<PostingAccess>(FULL_ACCESS);

export const PostingAccessProvider = PostingAccessContext.Provider;

/** Sửa hồ sơ / dịch vụ gắn thêm (so-hoa:update). */
export function usePostingCanWrite(): boolean {
  return useContext(PostingAccessContext).edit;
}

/** Chọn báo giá, huỷ yêu cầu, hợp đồng dịch vụ (ky-gui:update). */
export function usePostingCanConsign(): boolean {
  return useContext(PostingAccessContext).consign;
}

/** Gửi yêu cầu báo giá tới tổ chức / nhờ sàn chọn giúp (ky-gui:create). */
export function usePostingCanSendToOrgs(): boolean {
  return useContext(PostingAccessContext).consignCreate;
}
