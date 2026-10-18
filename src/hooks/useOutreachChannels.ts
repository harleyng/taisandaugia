import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { qk } from "@/lib/queryKeys";
import { orgContactErrorMessage } from "@/lib/orgContacts/errors";
import type { OutreachChannel } from "@/lib/outreach/channels";

/**
 * Kênh của gói tiếp thị (session_outreach_channels). Bảng chỉ có policy SELECT — mọi
 * ghi qua RPC outreach_* (20261018120000 / 20261018130000).
 */

const showError = (err: unknown) => toast.error(orgContactErrorMessage(err));

function useInvalidate(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: qk.sessionOutreach.bySession(sessionId) });
}

export function useOutreachChannels(sessionId: string | undefined, packId: string | null) {
  return useQuery({
    queryKey: qk.sessionOutreach.channels(sessionId),
    enabled: !!packId,
    queryFn: async (): Promise<OutreachChannel[]> => {
      const { data, error } = await supabase
        .from("session_outreach_channels")
        .select("*")
        .eq("pack_id", packId!)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as OutreachChannel[];
    },
  });
}

export type ChannelPatch = Partial<
  Pick<OutreachChannel, "name" | "target" | "own_content" | "custom_head" | "custom_body" | "custom_cta" | "scheduled_at">
> & { post_options?: object | null };

/** Lưu ngầm (trình soạn tự lưu) — không toast khi thành công. */
export function useUpdateChannel(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (v: { channelId: string; patch: ChannelPatch }) => {
      const { error } = await supabase.rpc("outreach_update_channel", {
        _channel_id: v.channelId,
        _patch: v.patch as unknown as Json,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.sessionOutreach.channels(sessionId) }),
    onError: showError,
  });
}


