import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { toast } from "sonner";

export function useAssetActions() {
  const { openAuthDialog } = useAuthDialog();
  const [session, setSession] = useState<any>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const fetchActions = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("user_asset_actions")
      .select("listing_id, is_saved")
      .eq("user_id", userId);

    if (data) {
      setSavedIds(new Set(data.filter((r) => r.is_saved).map((r) => r.listing_id)));
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) fetchActions(data.session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);

      if (s) {
        fetchActions(s.user.id);
      } else {
        setSavedIds(new Set());
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchActions]);

  const upsertAction = useCallback(async (listingId: string, value: boolean) => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    const { data: existing } = await supabase
      .from("user_asset_actions")
      .select("id, is_saved")
      .eq("user_id", userId)
      .eq("listing_id", listingId)
      .maybeSingle();

    if (existing) {
      if (!value) {
        await supabase.from("user_asset_actions").delete().eq("id", existing.id);
      } else {
        await supabase.from("user_asset_actions").update({ is_saved: value }).eq("id", existing.id);
      }
    } else if (value) {
      await supabase.from("user_asset_actions").insert({
        user_id: userId,
        listing_id: listingId,
        is_saved: true,
      });
    }
  }, [session]);

  const ensureNotificationsEnabled = useCallback(async () => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    const { data } = await supabase
      .from("profiles")
      .select("notifications_enabled")
      .eq("id", userId)
      .maybeSingle();

    if (data && data.notifications_enabled !== true) {
      await supabase
        .from("profiles")
        .update({ notifications_enabled: true } as any)
        .eq("id", userId);
    }
  }, [session]);

  const toggleSaveInner = useCallback(async (listingId: string, newVal?: boolean) => {
    const val = newVal ?? !savedIds.has(listingId);

    setSavedIds((prev) => {
      const next = new Set(prev);
      val ? next.add(listingId) : next.delete(listingId);
      return next;
    });

    toast(
      val
        ? "Đã theo dõi — bạn sẽ nhận thông báo khi có cập nhật"
        : "Đã ngừng theo dõi tài sản",
    );
    await upsertAction(listingId, val);

    if (val) {
      // Auto-bật master switch thông báo khi follow tài sản đầu tiên
      await ensureNotificationsEnabled();
    }
  }, [savedIds, upsertAction, ensureNotificationsEnabled]);

  const toggleSave = useCallback((listingId: string) => {
    if (!session) {
      openAuthDialog(() => toggleSaveInner(listingId, true));
      return;
    }

    const currentlySaved = savedIds.has(listingId);
    toggleSaveInner(listingId, !currentlySaved);
  }, [session, savedIds, openAuthDialog, toggleSaveInner]);

  return { savedIds, toggleSave, session };
}
