import { supabase } from "@/integrations/supabase/client";
import type { LegalActiveVersions } from "@/types/legal";

/**
 * Đóng dấu consent phiên bản pháp lý hiện hành lên profile của user.
 *
 * Ý nghĩa: "nhấn Đăng nhập = đồng ý Điều khoản & Chính sách phiên bản hiện hành".
 * Được gọi khi có sự kiện SIGNED_IN (email/phone/OAuth). Idempotent — gọi lại với
 * cùng phiên bản không gây hại. Chỉ ghi cho loại đang có phiên bản active.
 */
export async function stampConsent(userId: string, active: LegalActiveVersions) {
  const now = new Date().toISOString();
  const patch: Record<string, string> = {};
  if (active.terms) {
    patch.terms_version = active.terms;
    patch.terms_accepted_at = now;
  }
  if (active.privacy) {
    patch.privacy_version = active.privacy;
    patch.privacy_accepted_at = now;
  }
  if (Object.keys(patch).length === 0) return;
  await supabase.from("profiles").update(patch).eq("id", userId);
}
