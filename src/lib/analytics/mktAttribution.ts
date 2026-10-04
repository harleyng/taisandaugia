// Ghi nhận nguồn truyền thông (docs/owner-marketing-plan.md Phase M5): khách mở link theo dõi
// /l/:code (cookie mkt_link_id 30 ngày, lần chạm cuối thắng) rồi lưu tài sản / đăng ký tham gia.
//
// Fire-and-forget như track.ts: không await, nuốt lỗi, không bao giờ chặn người mua. Mọi chốt chặn
// ở server (trigger analytics_events_mkt_guard, RPC mkt_attribute_bidding_contract) — client chỉ
// gửi id link đang có trong cookie.

import { supabase } from "@/integrations/supabase/client";
import { readMktAttribution } from "@/lib/ownerMarketing/links";
import { trackFeature } from "./track";

/** Lưu (theo dõi) tài sản — luôn ghi sự kiện; có cookie thì kèm link để server xác nhận. */
export function trackAssetSaved(listingId: string, userId: string): void {
  trackFeature("save_asset", { userId, listingId, mktLinkId: readMktAttribution() });
}

/** Hồ sơ tham gia vừa tạo / gia hạn giữ chỗ — gắn link (lần gắn đầu thắng, server tự kiểm). */
export function attributeBiddingContract(contractId: string): void {
  const linkId = readMktAttribution();
  if (!linkId) return;
  void supabase
    .rpc("mkt_attribute_bidding_contract", { p_contract_id: contractId, p_link_id: linkId })
    .then(undefined, () => {
      /* nuốt lỗi: ghi nhận nguồn không được chặn đăng ký */
    });
}
