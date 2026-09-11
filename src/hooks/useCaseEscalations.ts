import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";
import { caseQaErrorMessage } from "@/lib/caseQa/errors";
import { qk } from "@/lib/queryKeys";
import type { EscalationStatus } from "@/types/case-qa";
import type { CaseEscalation } from "@/types/case-chat";

/**
 * Sổ câu hỏi chuyển tiếp — câu tài liệu phiên chưa trả lời được, để tổ chức bổ
 * sung vào tài liệu. Trạng thái sổ TÁCH khỏi việc đã trả lời người hỏi hay chưa.
 */

const SELECT = "*, auction_sessions(code, title), chat_conversations(contact_name, is_simulated)";

export function useOrgCaseEscalations(status: EscalationStatus | "all", sessionId?: string | null) {
  const { currentOrgId } = useOrg();
  const canView = useHasOrgPermission("hoi-dap", "view");
  return useQuery({
    queryKey: qk.orgChat.escalations(currentOrgId, `${status}:${sessionId ?? "*"}`),
    enabled: !!currentOrgId && canView,
    queryFn: async (): Promise<CaseEscalation[]> => {
      let query = supabase.from("case_question_escalations").select(SELECT).eq("organization_id", currentOrgId!);
      if (status !== "all") query = query.eq("status", status);
      if (sessionId) query = query.eq("session_id", sessionId);
      const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as CaseEscalation[];
    },
  });
}

function useInvalidate() {
  const queryClient = useQueryClient();
  const { currentOrgId } = useOrg();
  return (sessionId?: string | null) => {
    queryClient.invalidateQueries({ queryKey: qk.orgChat.all(currentOrgId) });
    if (sessionId) queryClient.invalidateQueries({ queryKey: qk.caseQa.bySession(sessionId) });
  };
}

const onError = (err: unknown) => toast.error(caseQaErrorMessage(err));

export function useResolveCaseEscalation() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: { escalation: CaseEscalation; status: EscalationStatus; note: string; clauseId?: string | null }) => {
      const { error } = await supabase.rpc("org_resolve_case_escalation", {
        _escalation_id: input.escalation.id,
        _status: input.status,
        _note: input.note,
        _clause_id: input.clauseId ?? undefined,
      });
      if (error) throw error;
      return input.status;
    },
    onSuccess: (status) => {
      invalidate();
      toast.success(
        status === "added_to_case"
          ? "Đã đánh dấu: nội dung đã bổ sung vào tài liệu phiên."
          : status === "dismissed"
            ? "Đã đánh dấu: không cần bổ sung."
            : "Đã mở lại câu hỏi chuyển tiếp.",
      );
    },
    onError,
  });
}

export function useAddClarificationClause() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: {
      escalation: CaseEscalation;
      clauseRef: string;
      heading: string;
      body: string;
      topics: string[];
      confirm: boolean;
    }) => {
      const { data, error } = await supabase.rpc("org_add_clarification_clause", {
        _escalation_id: input.escalation.id,
        _clause_ref: input.clauseRef.trim(),
        _heading: input.heading.trim(),
        _body: input.body.trim(),
        _topics: input.topics,
        _confirm: input.confirm,
      });
      if (error) throw error;
      return { clauseId: data as string, sessionId: input.escalation.session_id, confirm: input.confirm };
    },
    onSuccess: ({ sessionId, confirm }) => {
      invalidate(sessionId);
      toast.success(
        confirm
          ? "Đã thêm giải đáp bổ sung và xác nhận — AI dùng được ngay cho câu hỏi sau."
          : "Đã thêm giải đáp bổ sung (nháp) — xác nhận ở trang phiên để AI dùng.",
      );
    },
    onError,
  });
}
