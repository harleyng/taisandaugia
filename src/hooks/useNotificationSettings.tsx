import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile, type ProfileData } from "@/hooks/useProfile";

/**
 * Cài đặt thông báo derive từ query `profiles` dùng chung (`useProfile`) thay vì
 * tự `getSession` + fetch riêng. Toggle cập nhật optimistic vào cache rồi ghi DB.
 */
export function useNotificationSettings() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useProfile(userId);
  const notificationsEnabled = profile?.notificationsEnabled ?? false;

  const toggleNotifications = useCallback(
    async (val: boolean) => {
      if (!userId) return;
      const key = ["profile", userId];

      // Optimistic
      queryClient.setQueryData<ProfileData>(key, (old) =>
        old ? { ...old, notificationsEnabled: val } : old,
      );

      const { error } = await supabase
        .from("profiles")
        .update({ notifications_enabled: val } as never)
        .eq("id", userId);

      if (error) {
        // Revert
        queryClient.setQueryData<ProfileData>(key, (old) =>
          old ? { ...old, notificationsEnabled: !val } : old,
        );
        toast.error("Không thể cập nhật cài đặt thông báo");
      } else {
        toast(val ? "Đã bật thông báo" : "Đã tắt thông báo");
      }
    },
    [userId, queryClient],
  );

  return { notificationsEnabled, loading: isLoading, toggleNotifications };
}
