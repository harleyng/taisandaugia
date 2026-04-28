import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AgentInfoShape,
  buildTasks,
  getAvailableRewardCredits,
  hasUnclaimedRewards,
  OnboardingTask,
  REWARD_BASIC_CREDITS,
  REWARD_INTENT_CREDITS,
  REWARD_BASIC_TOKENS,
  REWARD_INTENT_TOKENS,
} from "@/lib/onboardingTasks";
import { addCredits } from "@/lib/mockCredits";

interface ProfileSnapshot {
  name: string | null;
  agentInfo: AgentInfoShape | null;
  freeUnlockTokens: number;
}

const EVT = "onboarding:profile-updated";
const emitProfileUpdated = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVT));
  }
};

export const useOnboardingTasks = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [snap, setSnap] = useState<ProfileSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("name, agent_info, free_unlock_tokens")
      .eq("id", uid)
      .maybeSingle();

    setSnap({
      name: data?.name ?? null,
      agentInfo: (data?.agent_info as AgentInfoShape | null) ?? null,
      freeUnlockTokens: (data as { free_unlock_tokens?: number } | null)?.free_unlock_tokens ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      const uid = session?.user.id ?? null;
      userIdRef.current = uid;
      setUserId(uid);
      if (uid) {
        await fetchProfile(uid);
      } else {
        setSnap(null);
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_evt, session) => {
      const uid = session?.user.id ?? null;
      userIdRef.current = uid;
      setUserId(uid);
      if (uid) await fetchProfile(uid);
      else setSnap(null);
    });

    const handler = () => {
      const uid = userIdRef.current;
      if (uid) fetchProfile(uid);
    };
    window.addEventListener(EVT, handler);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener(EVT, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchProfile]);

  // Re-fetch when userId changes (covered by onAuthStateChange but safe)
  useEffect(() => {
    if (userId) fetchProfile(userId);
  }, [userId, fetchProfile]);

  const tasks: OnboardingTask[] = buildTasks(snap?.agentInfo, snap?.name);
  const availableCredits = getAvailableRewardCredits(tasks);
  const hasUnclaimed = hasUnclaimedRewards(tasks);

  const claimReward = useCallback(
    async (key: "basic" | "intent"): Promise<{ ok: boolean; credits: number; tokens: number }> => {
      if (!userId || !snap) return { ok: false, credits: 0, tokens: 0 };

      const task = tasks.find((t) => t.key === key);
      if (!task || task.status !== "ready") {
        return { ok: false, credits: 0, tokens: 0 };
      }

      const credits = key === "basic" ? REWARD_BASIC_CREDITS : REWARD_INTENT_CREDITS;
      const tokens = key === "basic" ? REWARD_BASIC_TOKENS : REWARD_INTENT_TOKENS;

      const nextRewards = {
        ...(snap.agentInfo?.rewards ?? {}),
        [`${key}_claimed_at`]: Date.now(),
        [`${key}_completed_at`]: snap.agentInfo?.rewards?.[`${key}_completed_at` as keyof typeof snap.agentInfo.rewards] ?? Date.now(),
      };

      const nextAgentInfo = {
        ...(snap.agentInfo ?? {}),
        rewards: nextRewards,
      };

      const { error } = await supabase
        .from("profiles")
        .update({
          agent_info: nextAgentInfo as never,
          free_unlock_tokens: (snap.freeUnlockTokens ?? 0) + tokens,
        })
        .eq("id", userId);

      if (error) return { ok: false, credits: 0, tokens: 0 };

      // Tặng credit qua mockCredits store
      addCredits(credits);

      // Refresh
      await fetchProfile(userId);
      emitProfileUpdated();

      return { ok: true, credits, tokens };
    },
    [userId, snap, tasks, fetchProfile]
  );

  return {
    loading,
    isAuthed: Boolean(userId),
    tasks,
    availableCredits,
    hasUnclaimed,
    freeUnlockTokens: snap?.freeUnlockTokens ?? 0,
    agentInfo: snap?.agentInfo ?? null,
    name: snap?.name ?? null,
    claimReward,
    refresh: useCallback(() => {
      const uid = userIdRef.current;
      if (uid) fetchProfile(uid);
    }, [fetchProfile]),
  };
};

export const notifyProfileUpdated = emitProfileUpdated;
