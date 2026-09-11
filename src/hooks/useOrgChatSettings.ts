import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { caseQaErrorMessage } from "@/lib/caseQa/errors";
import { qk } from "@/lib/queryKeys";
import type { ChatMode } from "@/types/case-qa";
import type { ChatSettingsInput, OrgChatSettings } from "@/types/case-chat";

/**
 * Cấu hình trả lời tự động của tổ chức. Chưa có dòng = mặc định an toàn (soạn
 * nháp ở mọi kênh) — khớp public.case_chat_settings ở 20260912000101.
 * Ghi cần quyền `hoi-dap-cai-dat` (RLS), cao hơn quyền trả lời.
 */

export const DEFAULT_CHAT_SETTINGS: ChatSettingsInput = {
  marketplace_mode: "draft",
  zalo_mode: "draft",
  min_confidence: 0.8,
  escalation_reply: "Cảm ơn anh/chị đã hỏi. Nội dung này chưa có trong tài liệu phiên; chuyên viên sẽ phản hồi sớm.",
};

export function useOrgChatSettings() {
  const { currentOrgId } = useOrg();
  return useQuery({
    queryKey: qk.orgChat.settings(currentOrgId),
    enabled: !!currentOrgId,
    queryFn: async (): Promise<OrgChatSettings> => {
      const { data, error } = await supabase
        .from("org_chat_settings")
        .select("*")
        .eq("organization_id", currentOrgId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { ...DEFAULT_CHAT_SETTINGS, isDefault: true, updated_at: null };
      return {
        marketplace_mode: data.marketplace_mode as ChatMode,
        zalo_mode: data.zalo_mode as ChatMode,
        min_confidence: Number(data.min_confidence),
        escalation_reply: data.escalation_reply,
        isDefault: false,
        updated_at: data.updated_at,
      };
    },
  });
}

export function useSaveOrgChatSettings() {
  const queryClient = useQueryClient();
  const { currentOrgId } = useOrg();
  return useMutation({
    mutationFn: async (input: ChatSettingsInput) => {
      if (!currentOrgId) throw new Error("Chưa xác định được tổ chức.");
      const { error } = await supabase
        .from("org_chat_settings")
        .upsert({ organization_id: currentOrgId, ...input }, { onConflict: "organization_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.orgChat.settings(currentOrgId) });
      toast.success("Đã lưu cấu hình trả lời tự động.");
    },
    onError: (err) => toast.error(caseQaErrorMessage(err)),
  });
}
