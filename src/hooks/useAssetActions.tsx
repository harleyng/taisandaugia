import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { toast } from "sonner";

export function useAssetActions() {
  const { openAuthDialog } = useAuthDialog();
  const [session, setSession] = useState<any>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      if (s) fetchActions(s.user.id);
      else { setSavedIds(new Set()); setFollowingIds(new Set()); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchActions = async (userId: string) => {
    const { data } = await supabase
      .from("user_asset_actions")
      .select("listing_id, is_saved, is_following")
      .eq("user_id", userId);
    if (data) {
      setSavedIds(new Set(data.filter(r => r.is_saved).map(r => r.listing_id)));
      setFollowingIds(new Set(data.filter(r => r.is_following).map(r => r.listing_id)));
    }
  };

  useEffect(() => {
    if (session?.user?.id) fetchActions(session.user.id);
  }, [session?.user?.id]);

  const upsertAction = useCallback(async (listingId: string, field: "is_saved" | "is_following", value: boolean) => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    // Check if row exists
    const { data: existing } = await supabase
      .from("user_asset_actions")
      .select("id, is_saved, is_following")
      .eq("user_id", userId)
      .eq("listing_id", listingId)
      .maybeSingle();

    if (existing) {
      const updated = { ...existing, [field]: value };
      // If both false, delete
      if (!updated.is_saved && !updated.is_following) {
        await supabase.from("user_asset_actions").delete().eq("id", existing.id);
      } else {
        await supabase.from("user_asset_actions").update({ [field]: value }).eq("id", existing.id);
      }
    } else if (value) {
      await supabase.from("user_asset_actions").insert({
        user_id: userId,
        listing_id: listingId,
        [field]: value,
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
    // Optimistic
    setSavedIds(prev => {
      const next = new Set(prev);
      val ? next.add(listingId) : next.delete(listingId);
      return next;
    });
    toast(val ? "Đã lưu vào Quan tâm" : "Đã bỏ khỏi Quan tâm");
    await upsertAction(listingId, "is_saved", val);
  }, [savedIds, upsertAction]);

  const toggleFollow = useCallback((listingId: string) => {
    if (!session) {
      openAuthDialog(() => toggleFollowInner(listingId, true));
      return;
    }
    const currentlyFollowing = followingIds.has(listingId);
    toggleFollowInner(listingId, !currentlyFollowing);
  }, [session, followingIds, openAuthDialog]);

  const toggleFollowInner = useCallback(async (listingId: string, newVal?: boolean) => {
    const val = newVal ?? !followingIds.has(listingId);
    setFollowingIds(prev => {
      const next = new Set(prev);
      val ? next.add(listingId) : next.delete(listingId);
      return next;
    });
    toast(val ? "Đã bật nhận thông tin" : "Đã tắt nhận thông tin");
    await upsertAction(listingId, "is_following", val);
  }, [followingIds, upsertAction]);

  return { savedIds, followingIds, toggleSave, toggleFollow, session };
}
