import { createContext, useContext } from "react";

/**
 * Người đang xem có GHI được hồ sơ số hoá đang mở không (Phase 4 — hồ sơ thuộc
 * không gian: Người xem / Cán bộ ngoài phạm vi chi nhánh chỉ đọc). Chỉ để ẨN nút;
 * RLS + RPC (owner_posting_can) mới là cổng thật.
 *
 * Mặc định `true`: các khối dùng chung với wizard (3D, VR, giám định…) nằm ngoài
 * trang chi tiết thì wizard tự cung cấp giá trị của nó.
 */
const PostingAccessContext = createContext<boolean>(true);

export const PostingAccessProvider = PostingAccessContext.Provider;

export function usePostingCanWrite(): boolean {
  return useContext(PostingAccessContext);
}
