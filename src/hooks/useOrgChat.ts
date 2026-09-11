import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useOrg } from "@/contexts/OrgContext";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";
import { caseQaErrorMessage } from "@/lib/caseQa/errors";
import { qk } from "@/lib/queryKeys";
import type { ChatChannel, ConversationStatus } from "@/types/case-qa";
import type { ChatAttentionCounts, ChatConversation, ChatThread, ChatThreadMessage, InboxRow, QaRpcResult } from "@/types/case-chat";
import { useProposeCaseAnswer } from "./useCaseQaAnswer";

/**
 * Hộp thư đa kênh của tổ chức (/portal/hoi-dap, module `hoi-dap`).
 *
 * Bảng chat chỉ có policy SELECT: mọi ghi đi qua RPC tự kiểm quyền. Chưa có
 * realtime trong dự án ⇒ hỏi lại theo chu kỳ. Mọi mutation làm mới prefix
 * qk.orgChat.all(org) — phủ hộp thư, luồng, số đếm, sổ chuyển tiếp.
 */

export type InboxFilter = "attention" | "all";

const POLL_INBOX_MS = 20_000;
const POLL_COUNTS_MS = 60_000;

export function useOrgChatInbox(filter: InboxFilter, channel: ChatChannel | null, sessionId: string | null) {
  const { currentOrgId } = useOrg();
  const canView = useHasOrgPermission("hoi-dap", "view");
  return useQuery({
    queryKey: qk.orgChat.inbox(currentOrgId, filter, channel, sessionId),
    enabled: !!currentOrgId && canView,
    refetchInterval: POLL_INBOX_MS,
    queryFn: async (): Promise<InboxRow[]> => {
      const { data, error } = await supabase.rpc("org_chat_inbox", {
        _org_id: currentOrgId!,
        _filter: filter,
        _channel: channel ?? undefined,
        _session_id: sessionId ?? undefined,
      });
      if (error) throw error;
      return (data ?? []) as unknown as InboxRow[];
    },
  });
}

export function useChatThread(conversationId: string | null) {
  const { currentOrgId } = useOrg();
  return useQuery({
    queryKey: qk.orgChat.thread(currentOrgId, conversationId),
    enabled: !!currentOrgId && !!conversationId,
    refetchInterval: POLL_INBOX_MS,
    queryFn: async (): Promise<ChatThread | null> => {
      const [conv, msgs] = await Promise.all([
        supabase.from("chat_conversations").select("*").eq("id", conversationId!).maybeSingle(),
        supabase
          .from("chat_messages")
          .select("*, auction_sessions(code, title), case_question_escalations(reason, status)")
          .eq("conversation_id", conversationId!)
          .order("created_at", { ascending: true }),
      ]);
      if (conv.error) throw conv.error;
      if (msgs.error) throw msgs.error;
      if (!conv.data) return null;
      return {
        conversation: conv.data as unknown as ChatConversation,
        messages: (msgs.data ?? []) as unknown as ChatThreadMessage[],
      };
    },
  });
}

export function useChatAttentionCounts(): ChatAttentionCounts {
  const { currentOrgId } = useOrg();
  const canView = useHasOrgPermission("hoi-dap", "view");
  const query = useQuery({
    queryKey: qk.orgChat.counts(currentOrgId),
    enabled: !!currentOrgId && canView,
    refetchInterval: POLL_COUNTS_MS,
    queryFn: async (): Promise<ChatAttentionCounts> => {
      const { data, error } = await supabase.rpc("org_chat_attention_counts", { _org_id: currentOrgId! });
      if (error) throw error;
      const raw = (data ?? {}) as { awaiting_reply?: number; drafts?: number; open_escalations?: number };
      return {
        awaitingReply: raw.awaiting_reply ?? 0,
        drafts: raw.drafts ?? 0,
        openEscalations: raw.open_escalations ?? 0,
      };
    },
  });
  return query.data ?? { awaitingReply: 0, drafts: 0, openEscalations: 0 };
}

// ─── Mutations ──────────────────────────────────────────────────────────────

function useInvalidateChat() {
  const queryClient = useQueryClient();
  const { currentOrgId } = useOrg();
  return () => queryClient.invalidateQueries({ queryKey: qk.orgChat.all(currentOrgId) });
}

const onError = (err: unknown) => toast.error(caseQaErrorMessage(err));

const STAFF_RESULT_TOAST: Record<QaRpcResult["state"], string> = {
  auto_answered: "AI đã tự gửi câu trả lời có trích dẫn (theo cấu hình tự gửi).",
  draft_ready: "AI đã soạn nháp có trích dẫn — chờ chuyên viên duyệt.",
  escalated: "Không trả lời được từ tài liệu phiên — đã chuyển chuyên viên.",
};

export function useSimulateZaloMessage() {
  const invalidate = useInvalidateChat();
  const propose = useProposeCaseAnswer();
  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      sessionCode: string;
      senderName: string;
      senderPhone: string;
      body: string;
    }): Promise<QaRpcResult> => {
      const proposal = await propose(input.sessionId, input.sessionCode, input.body);
      const { data, error } = await supabase.rpc("org_simulate_zalo_message", {
        _session_id: input.sessionId,
        _sender_name: input.senderName.trim(),
        _sender_phone: input.senderPhone.trim(),
        _body: input.body.trim(),
        _proposal: proposal as unknown as Json,
      });
      if (error) throw error;
      return data as unknown as QaRpcResult;
    },
    onSuccess: (result) => {
      invalidate();
      toast.success(STAFF_RESULT_TOAST[result.state]);
    },
    onError,
  });
}

export function useRetryCaseAnswer() {
  const invalidate = useInvalidateChat();
  const propose = useProposeCaseAnswer();
  return useMutation({
    mutationFn: async (input: { messageId: string; sessionId: string; sessionCode: string; question: string }) => {
      const proposal = await propose(input.sessionId, input.sessionCode, input.question);
      const { data, error } = await supabase.rpc("org_retry_case_answer", {
        _message_id: input.messageId,
        _proposal: proposal as unknown as Json,
      });
      if (error) throw error;
      return data as unknown as QaRpcResult;
    },
    onSuccess: (result) => {
      invalidate();
      toast.success(STAFF_RESULT_TOAST[result.state]);
    },
    onError,
  });
}

export function useSendChatDraft() {
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: async ({ draftId, editedBody }: { draftId: string; editedBody?: string }) => {
      const { error } = await supabase.rpc("org_send_chat_draft", { _draft_id: draftId, _edited_body: editedBody });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã gửi câu trả lời.");
    },
    onError,
  });
}

export function useDiscardChatDraft() {
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: async (draftId: string) => {
      const { error } = await supabase.rpc("org_discard_chat_draft", { _draft_id: draftId });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã bỏ bản nháp — câu hỏi vẫn chờ chuyên viên trả lời.");
    },
    onError,
  });
}

export function useSendStaffReply() {
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: async (input: { conversationId: string; body: string; inReplyTo: string | null; clauseIds: string[] }) => {
      const { error } = await supabase.rpc("org_send_staff_reply", {
        _conversation_id: input.conversationId,
        _body: input.body.trim(),
        _in_reply_to: input.inReplyTo ?? undefined,
        _clause_ids: input.clauseIds,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã gửi trả lời.");
    },
    onError,
  });
}

export function useSetConversationStatus() {
  const invalidate = useInvalidateChat();
  return useMutation({
    mutationFn: async ({ conversationId, status }: { conversationId: string; status: ConversationStatus }) => {
      const { error } = await supabase.rpc("org_set_conversation_status", {
        _conversation_id: conversationId,
        _status: status,
      });
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      invalidate();
      toast.success(status === "resolved" ? "Đã đóng hội thoại." : "Đã mở lại hội thoại.");
    },
    onError,
  });
}
