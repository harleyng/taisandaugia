import { useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { qk } from "@/lib/queryKeys";

const EMPTY_SET: Set<string> = new Set();

export function useAssetActions() {
  const { openAuthDialog } = useAuthDialog();
  const { session, userId } = useAuth();
  const queryClient = useQueryClient();

  // userId luôn mới nhất cho các callback (tránh stale closure ở flow
  // "đăng nhập xong rồi mới lưu" qua openAuthDialog).
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;

  const { data: savedIds = EMPTY_SET } = useQuery<Set<string>>({
    queryKey: ["asset-actions", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_asset_actions")
        .select("listing_id, is_saved")
        .eq("user_id", userId!);
      return new Set((data ?? []).filter((r) => r.is_saved).map((r) => r.listing_id));
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const setSavedOptimistic = useCallback(
    (listingId: string, val: boolean) => {
      const uid = userIdRef.current;
      queryClient.setQueryData<Set<string>>(["asset-actions", uid], (prev) => {
        const next = new Set(prev ?? []);
        if (val) next.add(listingId);
        else next.delete(listingId);
        return next;
      });
    },
    [queryClient],
  );

  const upsertAction = useCallback(async (listingId: string, value: boolean) => {
    const uid = userIdRef.current;
    if (!uid) return;

    const { data: existing } = await supabase
      .from("user_asset_actions")
      .select("id, is_saved")
      .eq("user_id", uid)
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
        user_id: uid,
        listing_id: listingId,
        is_saved: true,
      });
    }
  }, []);

  const ensureNotificationsEnabled = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    const { data } = await supabase
      .from("profiles")
      .select("notifications_enabled")
      .eq("id", uid)
      .maybeSingle();

    if (data && data.notifications_enabled !== true) {
      await supabase
        .from("profiles")
        .update({ notifications_enabled: true } as never)
        .eq("id", uid);
      queryClient.invalidateQueries({ queryKey: qk.profile.byUser(uid) });
    }
  }, [queryClient]);

  const toggleSaveInner = useCallback(
    async (listingId: string, newVal?: boolean) => {
      const uid = userIdRef.current;
      const current =
        queryClient.getQueryData<Set<string>>(["asset-actions", uid])?.has(listingId) ?? false;
      const val = newVal ?? !current;

      setSavedOptimistic(listingId, val);

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
    },
    [queryClient, setSavedOptimistic, upsertAction, ensureNotificationsEnabled],
  );

  const toggleSave = useCallback(
    (listingId: string) => {
      if (!userIdRef.current) {
        openAuthDialog(() => toggleSaveInner(listingId, true));
        return;
      }
      toggleSaveInner(listingId);
    },
    [openAuthDialog, toggleSaveInner],
  );

  return { savedIds, toggleSave, session };
}
