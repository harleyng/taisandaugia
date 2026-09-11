// Được đánh dấu "đã gửi" khi nào.
//
// BẢN SAO SQL: public.outreach_send_window_open trong
// supabase/migrations/20260912000013_session_outreach.sql. Server là ranh giới
// thật; hàm này chỉ để tắt nút trước khi người dùng bấm vào lỗi. Sửa một bên phải
// sửa cả hai (sendWindow.test.ts ghim các mốc biên).

import { sessionPhaseOf, type SessionPublishStatus, type SessionTiming } from "@/lib/auctionSessions/phase";

export function canMarkSent(
  s: SessionTiming & { status: SessionPublishStatus },
  now: Date = new Date(),
): boolean {
  return s.status === "published" && sessionPhaseOf(s, now) === "registration_open";
}
