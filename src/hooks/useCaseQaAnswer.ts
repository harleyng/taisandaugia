import { useCallback } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { answerCaseQuestion } from "@/lib/caseQa/answerEngine";
import { qk } from "@/lib/queryKeys";
import type { CaseQaProposal } from "@/types/case-qa";
import { fetchCitableClauses } from "./useCitableClauses";

/**
 * Soạn ĐỀ XUẤT trả lời một câu hỏi từ tài liệu phiên.
 *
 * ĐÂY LÀ SEAM ĐỔI SANG AI THẬT. Hôm nay engine mock chạy ngay trên trình duyệt;
 * khi có Edge Function thì:
 *   1. Edge Function `answer-case-question` (service_role) tự đọc điều khoản, gọi
 *      mô hình, rồi gọi thẳng case_qa_apply_proposal;
 *   2. bỏ tham số `_proposal` khỏi ask_case_question / org_simulate_zalo_message /
 *      org_retry_case_answer, và bỏ hàm này.
 *
 * Đề xuất KHÔNG phải ranh giới tin cậy — server kiểm lại từng trích dẫn và tự dựng
 * câu trả lời (20260912000101). Đừng thêm văn bản câu trả lời vào đề xuất.
 */
export async function proposeCaseAnswer(
  queryClient: QueryClient,
  sessionId: string,
  sessionCode: string,
  question: string,
): Promise<CaseQaProposal> {
  const clauses = await queryClient.fetchQuery({
    queryKey: qk.caseQa.citable(sessionId),
    queryFn: () => fetchCitableClauses(sessionId),
    staleTime: 15_000,
  });
  return answerCaseQuestion({ question, sessionCode, clauses });
}

export function useProposeCaseAnswer() {
  const queryClient = useQueryClient();
  return useCallback(
    (sessionId: string, sessionCode: string, question: string) =>
      proposeCaseAnswer(queryClient, sessionId, sessionCode, question),
    [queryClient],
  );
}
