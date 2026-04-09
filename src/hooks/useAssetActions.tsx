import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { toast } from "sonner";

export function useAssetActions() {
  const { openAuthDialog } = useAuthDialog();
  const [session, setSession] = useState<any>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      if (s) fetchActions(s.user.id);
      else setSavedIds(new Set());
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchActions = async (userId: string) => {
    const { data } = await supabase
      .from("user_asset_actions")
      .select("listing_id, is_saved")
      .eq("user_id", userId);
    if (data) {
      setSavedIds(new Set(data.filter(r => r.is_saved).map(r => r.listing_id)));
    }
  };

  useEffect(() => {
    if (session?.user?.id) fetchActions(session.user.id);
  }, [session?.user?.id]);

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

  const toggleSave = useCallback((listingId: string) => {
    if (!session) {
      openAuthDialog(() => toggleSaveInner(listingId, true));
      return;
    }
    const currentlySaved = savedIds.has(listingId);
    toggleSaveInner(listingId, !currentlySaved);
  }, [session, savedIds, openAuthDialog]);

  const toggleSaveInner = useCallback(async (listingId: string, newVal?: boolean) => {
    const val = newVal ?? !savedIds.has(listingId);
    const wasEmpty = savedIds.size === 0;

    setSavedIds(prev => {
      const next = new Set(prev);
      val ? next.add(listingId) : next.delete(listingId);
      return next;
    });
    toast(val ? "Đã lưu vào Quan tâm" : "Đã bỏ khỏi Quan tâm");
    await upsertAction(listingId, val);

    // Show notification prompt on first save
    if (val && wasEmpty && !localStorage.getItem("notification_prompt_shown")) {
      setShowNotificationPrompt(true);
      localStorage.setItem("notification_prompt_shown", "1");
    }
  }, [savedIds, upsertAction]);

  const dismissNotificationPrompt = useCallback(() => {
    setShowNotificationPrompt(false);
  }, []);

  return { savedIds, toggleSave, session, showNotificationPrompt, dismissNotificationPrompt };
}
