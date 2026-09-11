import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { caseQaErrorMessage } from "@/lib/caseQa/errors";
import { qk } from "@/lib/queryKeys";
import type { CitationSnapshot, MyQuestionState } from "@/types/case-qa";
import type { MyCaseQuestion, QaRpcResult } from "@/types/case-chat";
import { useProposeCaseAnswer } from "./useCaseQaAnswer";

/**
 * Câu hỏi của người mua trên trang hỏi đáp công khai của một phiên.
 *
 * Người mua KHÔNG có policy nào trên bảng chat: đọc qua my_case_questions (bản
 * chiếu chỉ gồm câu trả lời ĐÃ GỬI của chính mình), ghi qua ask_case_question.
 */

const POLL_MS = 15_000;

export function useMyCaseQuestions(sessionId?: string | null) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.caseQa.mine(sessionId, userId),
    enabled: !!sessionId && !!userId,
    // Chỉ hỏi lại server khi còn câu đang chờ chuyên viên.
    refetchInterval: (query) =>
      query.state.data?.some((q) => q.state === "pending_review" || q.state === "escalated") ? POLL_MS : false,
    queryFn: async (): Promise<MyCaseQuestion[]> => {
      const { data, error } = await supabase.rpc("my_case_questions", { _session_id: sessionId! });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        message_id: r.message_id,
        question: r.question,
        asked_at: r.asked_at,
        state: r.state as MyQuestionState,
        answer_body: r.answer_body ?? null,
        answer_citations: ((r.answer_citations ?? []) as unknown as CitationSnapshot[]) ?? [],
        answered_at: r.answered_at ?? null,
        answered_by: (r.answered_by as "ai" | "staff" | null) ?? null,
      }));
    },
  });
}

const RESULT_TOAST: Record<QaRpcResult["state"], string> = {
  auto_answered: "Đã có câu trả lời trích từ tài liệu phiên.",
  draft_ready: "Đã gửi câu hỏi — chuyên viên sẽ xác nhận câu trả lời trước khi gửi.",
  escalated: "Tài liệu phiên chưa nêu nội dung này — câu hỏi đã được chuyển cho chuyên viên.",
};

export function useAskCaseQuestion(session: { id: string; code: string | null }) {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  const propose = useProposeCaseAnswer();
  return useMutation({
    mutationFn: async (input: { question: string; contactName: string; contactPhone: string }): Promise<QaRpcResult> => {
      const proposal = await propose(session.id, session.code ?? "", input.question);
      const { data, error } = await supabase.rpc("ask_case_question", {
        _session_id: session.id,
        _question: input.question.trim(),
        _contact_name: input.contactName.trim(),
        _contact_phone: input.contactPhone.trim(),
        _proposal: proposal as unknown as Json,
      });
      if (error) throw error;
      return data as unknown as QaRpcResult;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: qk.caseQa.mine(session.id, userId) });
      if (result.state === "auto_answered") toast.success(RESULT_TOAST[result.state]);
      else toast.info(RESULT_TOAST[result.state]);
    },
    onError: (err) => toast.error(caseQaErrorMessage(err)),
  });
}
