import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AgentInfoShape } from "@/lib/onboardingTasks";
import { qk } from "@/lib/queryKeys";

export interface ProfileData {
  name: string | null;
  agentInfo: AgentInfoShape | null;
  freeUnlockTokens: number;
  notificationsEnabled: boolean;
  termsVersion: string | null;
  privacyVersion: string | null;
}

/**
 * Nguồn dữ liệu `profiles` DUY NHẤT (name, agent_info, free_unlock_tokens).
 *
 * Trước đây hàng `profiles` bị fetch không cache ở nhiều nơi (Header,
 * ProfilePage, useOnboardingTasks…). Hook React Query này dùng chung một
 * queryKey `["profile", userId]` nên mọi consumer dedupe về một request và
 * có cache. Ghi dữ liệu xong chỉ cần `invalidateQueries(["profile", userId])`.
 */
export function useProfile(userId: string | null | undefined) {
  return useQuery<ProfileData>({
    queryKey: qk.profile.byUser(userId),
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "name, agent_info, free_unlock_tokens, notifications_enabled, terms_version, privacy_version",
        )
        .eq("id", userId!)
        .maybeSingle();

      return {
        name: data?.name ?? null,
        agentInfo: (data?.agent_info as AgentInfoShape | null) ?? null,
        freeUnlockTokens:
          (data as { free_unlock_tokens?: number } | null)?.free_unlock_tokens ?? 0,
        notificationsEnabled:
          (data as { notifications_enabled?: boolean } | null)?.notifications_enabled ?? false,
        termsVersion:
          (data as { terms_version?: string | null } | null)?.terms_version ?? null,
        privacyVersion:
          (data as { privacy_version?: string | null } | null)?.privacy_version ?? null,
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}
