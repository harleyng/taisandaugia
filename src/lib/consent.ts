import { supabase } from "@/integrations/supabase/client";
import type { LegalPlatform } from "@/types/legal";

/**
 * Đóng dấu consent Điều khoản & Chính sách đang áp dụng CỦA NỀN TẢNG lên tài khoản
 * đang đăng nhập.
 *
 * Ý nghĩa: "nhấn Đăng nhập = đồng ý phiên bản hiện hành". Được gọi khi có sự kiện
 * SIGNED_IN (email/phone/OAuth/đăng nhập liên kết). Server tự lấy phiên bản đang
 * áp dụng (client không tự khai được) và chỉ đổi mốc thời gian khi phiên bản đổi
 * ⇒ gọi lại nhiều lần vô hại. Kèm theo: nhận `signup_platform` cho tài khoản OAuth
 * mới (chưa có nền tảng đăng ký).
 */
export async function stampConsent(platform: LegalPlatform) {
  const { error } = await supabase.rpc("record_legal_consent", { p_platform: platform });
  if (error) console.warn("record_legal_consent", error.message);
}
