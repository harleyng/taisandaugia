// Đường dẫn dùng chung của luồng tư vấn đấu giá.

import { ownerPostingPath } from "@/lib/vrTour/paths";

/** Gốc trang chi tiết trong menu gộp "Yêu cầu dịch vụ" (`${gốc}/${id}`). */
export const ADMIN_AUCTION_CONSULT_PATH = "/admin/yeu-cau-dich-vu/tu-van-dau-gia";

/** Tab "Đấu giá" (gồm tư vấn đấu giá) trên trang hồ sơ của người bán — link cũ ?tab=tu-van-dau-gia vẫn chuyển về đây. */
export const AUCTION_CONSULT_TAB = "dau-gia";

export const ownerAuctionConsultPath = (postingId: string) =>
  `${ownerPostingPath(postingId)}?tab=${AUCTION_CONSULT_TAB}`;

/** Trang thanh toán VNPay cho một yêu cầu; thanh toán xong quay về tab tư vấn. */
export function auctionConsultCheckoutPath(consultationId: string, postingId: string): string {
  const sp = new URLSearchParams({ tvdg_order: consultationId, return: ownerAuctionConsultPath(postingId) });
  return `/payment/vnpay?${sp.toString()}`;
}
