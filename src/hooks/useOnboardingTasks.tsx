import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import {
  buildTasks,
  getAvailableRewardCredits,
  hasUnclaimedRewards,
  OnboardingTask,
  REWARD_BASIC_CREDITS,
  REWARD_INTENT_CREDITS,
  REWARD_BASIC_TOKENS,
  REWARD_INTENT_TOKENS,
} from "@/lib/onboardingTasks";
import { addCredits } from "@/lib/credits";
import { qk } from "@/lib/queryKeys";

const EVT = "onboarding:profile-updated";

/**
 * Phát sự kiện báo `profiles` đã thay đổi. Listener toàn cục trong AuthProvider
 * sẽ invalidate query `["profile", userId]` để mọi consumer (Header, các section…)
 * tự refetch. Giữ hàm này để các call site cũ không phải đổi.
 */
const emitProfileUpdated = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVT));
  }
};

/**
 * Nhiệm vụ onboarding 2 tầng. Trước đây hook tự `getSession` + fetch `profiles`
 * bằng useState (mỗi instance một request, lại double-fetch). Nay derive trực
 * tiếp từ `useProfile` (React Query, dùng chung cache) + `useAuth`.
 */
export const useOnboardingTasks = () => {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useProfile(userId);

  const agentInfo = profile?.agentInfo ?? null;
  const name = profile?.name ?? null;
  const freeUnlockTokens = profile?.freeUnlockTokens ?? 0;

  const tasks: OnboardingTask[] = buildTasks(agentInfo, name);
  const availableCredits = getAvailableRewardCredits(tasks);
  const hasUnclaimed = hasUnclaimedRewards(tasks);

  const invalidateProfile = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: qk.profile.byUser(userId) });
  }, [queryClient, userId]);

  const claimReward = useCallback(
    async (key: "basic" | "intent"): Promise<{ ok: boolean; credits: number; tokens: number }> => {
      if (!userId || !profile) return { ok: false, credits: 0, tokens: 0 };

      const task = tasks.find((t) => t.key === key);
      if (!task || task.status !== "ready") {
        return { ok: false, credits: 0, tokens: 0 };
      }

      const credits = key === "basic" ? REWARD_BASIC_CREDITS : REWARD_INTENT_CREDITS;
      const tokens = key === "basic" ? REWARD_BASIC_TOKENS : REWARD_INTENT_TOKENS;

      const nextRewards = {
        ...(agentInfo?.rewards ?? {}),
        [`${key}_claimed_at`]: Date.now(),
        [`${key}_completed_at`]:
          agentInfo?.rewards?.[`${key}_completed_at` as keyof typeof agentInfo.rewards] ?? Date.now(),
      };

      const nextAgentInfo = {
        ...(agentInfo ?? {}),
        rewards: nextRewards,
      };

      const { error } = await supabase
        .from("profiles")
        .update({
          agent_info: nextAgentInfo as never,
          free_unlock_tokens: (freeUnlockTokens ?? 0) + tokens,
        })
        .eq("id", userId);

      if (error) return { ok: false, credits: 0, tokens: 0 };

      // Tặng credit
      await addCredits(userId, credits);

      // Refresh cache profile + credits
      invalidateProfile();
      queryClient.invalidateQueries({ queryKey: qk.userCredits.byUser(userId) });

      return { ok: true, credits, tokens };
    },
    [userId, profile, agentInfo, freeUnlockTokens, tasks, invalidateProfile, queryClient],
  );

  const refresh = useCallback(() => {
    invalidateProfile();
  }, [invalidateProfile]);

  return {
    loading: isLoading,
    isAuthed: Boolean(userId),
    tasks,
    availableCredits,
    hasUnclaimed,
    freeUnlockTokens,
    agentInfo,
    name,
    claimReward,
    refresh,
  };
};

export const notifyProfileUpdated = emitProfileUpdated;
