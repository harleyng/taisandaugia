import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useLegalActiveVersions } from "@/hooks/useLegalDocuments";
import { stampConsent } from "@/lib/consent";
import { qk } from "@/lib/queryKeys";

/**
 * Cổng đồng ý điều khoản theo phiên bản (gắn MỘT lần cho toàn app — xem TermsGate).
 *
 * Hai nhánh tách rời theo sự kiện auth nên không đua/không lặp:
 *  • SIGNED_IN  (đăng nhập mới, mọi phương thức) → đóng dấu phiên bản hiện hành lên
 *    profile (nhấn Đăng nhập = đồng ý). KHÔNG bao giờ đăng xuất ở nhánh này.
 *  • INITIAL_SESSION (session khôi phục lúc tải trang) → nếu user đã đồng ý phiên bản
 *    CŨ (khác active) thì buộc đăng xuất để đồng ý lại. User chưa từng ghi nhận
 *    (version = null, vd tài khoản cũ/Google) KHÔNG bị đá ra — sẽ được đóng dấu ở
 *    lần SIGNED_IN kế tiếp.
 */
export function useTermsGate() {
  const { userId, authEvent } = useAuth();
  const qc = useQueryClient();
  const { data: active } = useLegalActiveVersions();
  const { data: profile } = useProfile(userId);
  const stampedForRef = useRef<string | null>(null);
  const loggingOutRef = useRef(false);

  // Reset cờ khi không còn session.
  useEffect(() => {
    if (!userId) {
      stampedForRef.current = null;
      loggingOutRef.current = false;
    }
  }, [userId]);

  // Đăng nhập mới → đồng ý ngầm phiên bản hiện hành.
  useEffect(() => {
    if (authEvent !== "SIGNED_IN" || !userId || !active) return;
    if (stampedForRef.current === userId) return;
    stampedForRef.current = userId;
    stampConsent(userId, active).then(() => {
      qc.invalidateQueries({ queryKey: qk.profile.byUser(userId) });
    });
  }, [authEvent, userId, active, qc]);

  // Session khôi phục lúc tải trang → buộc đăng xuất nếu đang ở phiên bản CŨ.
  useEffect(() => {
    if (authEvent !== "INITIAL_SESSION" || !userId || !active || !profile) return;
    if (loggingOutRef.current) return;
    const staleTerms =
      profile.termsVersion != null &&
      active.terms != null &&
      profile.termsVersion !== active.terms;
    const stalePrivacy =
      profile.privacyVersion != null &&
      active.privacy != null &&
      profile.privacyVersion !== active.privacy;
    if (staleTerms || stalePrivacy) {
      loggingOutRef.current = true;
      toast.info("Điều khoản/Chính sách đã cập nhật, vui lòng đăng nhập lại để tiếp tục.");
      supabase.auth.signOut();
    }
  }, [authEvent, userId, active, profile]);
}
