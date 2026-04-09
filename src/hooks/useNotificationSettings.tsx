import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useNotificationSettings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const { data } = await supabase
        .from("profiles")
        .select("notifications_enabled")
        .eq("id", session.user.id)
        .single();

      if (data) setNotificationsEnabled(data.notifications_enabled ?? false);
      setLoading(false);
    };
    fetch();
  }, []);

  const toggleNotifications = useCallback(async (val: boolean) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setNotificationsEnabled(val);
    const { error } = await supabase
      .from("profiles")
      .update({ notifications_enabled: val } as any)
      .eq("id", session.user.id);

    if (error) {
      setNotificationsEnabled(!val);
      toast.error("Không thể cập nhật cài đặt thông báo");
    } else {
      toast(val ? "Đã bật thông báo" : "Đã tắt thông báo");
    }
  }, []);

  return { notificationsEnabled, loading, toggleNotifications };
}
