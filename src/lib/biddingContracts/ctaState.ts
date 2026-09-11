// Trạng thái nút "Mua hồ sơ tham gia" trên trang chi tiết phiên.
//
// BẢN SAO PHÍA CLIENT của các chốt trong start_bidding_contract
// (supabase/migrations/20260911000005_auction_bidding_contracts.sql) — sửa một
// bên phải sửa cả bên kia. Server vẫn là nguồn sự thật; đây chỉ để không bày ra
// nút bấm chắc chắn lỗi.
//
// KHÁC sessionPhaseOf(): hàm đó bỏ qua registration_start_at (phiên chưa mở bán
// vẫn hiện "Đang bán hồ sơ"), còn ở đây mở bán sớm là chặn thật.

import type { SessionPublishStatus } from "@/lib/auctionSessions/phase";
import type { ContractStatus, ContractSummary } from "@/types/bidding-contract";

export interface CtaSession {
  status: SessionPublishStatus;
  starts_at: string;
  registration_start_at: string | null;
  registration_end_at: string | null;
  max_registrants: number | null;
  dossier_fee: number | null;
}

export interface CtaContract {
  status: ContractStatus;
}

export type ContractCta =
  | { kind: "paid" }
  | { kind: "cancelled_session" }
  | { kind: "closed" }
  | { kind: "not_for_sale" }
  | { kind: "not_open_yet"; opensAt: string }
  | { kind: "pending" }
  | { kind: "full" }
  | { kind: "login_required" }
  | { kind: "available" };

interface Input {
  session: CtaSession;
  /** Hồ sơ CHƯA huỷ của người xem cho phiên này (nếu có). */
  contract: CtaContract | null;
  /** null = chưa tải xong / không đọc được — khi đó chỉ dựa vào giá hồ sơ. */
  summary: ContractSummary | null;
  userId: string | null;
  now?: Date;
}

const at = (iso: string | null) => (iso ? Date.parse(iso) : Number.NaN);

export function contractCtaState({ session, contract, summary, userId, now = new Date() }: Input): ContractCta {
  // Đã trả tiền thì luôn cho xem hồ sơ của mình, kể cả khi phiên đã huỷ.
  if (contract?.status === "paid") return { kind: "paid" };
  if (session.status === "cancelled") return { kind: "cancelled_session" };
  if (session.status !== "published") return { kind: "not_for_sale" };

  const t = now.getTime();
  const regEnd = at(session.registration_end_at);
  if (t >= at(session.starts_at) || (!Number.isNaN(regEnd) && t > regEnd)) return { kind: "closed" };

  if (!((session.dossier_fee ?? 0) > 0) || (summary && !summary.sale_enabled)) return { kind: "not_for_sale" };

  const regStart = at(session.registration_start_at);
  if (!Number.isNaN(regStart) && t < regStart) {
    return { kind: "not_open_yet", opensAt: session.registration_start_at as string };
  }

  // Giữ chỗ hết hạn vẫn hiện "Tiếp tục thanh toán": bấm lại sẽ giữ chỗ mới.
  if (contract?.status === "pending_payment") return { kind: "pending" };

  if (session.max_registrants != null && summary && summary.paid_count + summary.held_count >= session.max_registrants) {
    return { kind: "full" };
  }
  if (!userId) return { kind: "login_required" };
  return { kind: "available" };
}
