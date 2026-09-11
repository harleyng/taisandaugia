import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "@/lib/queryKeys";
import type { CaseDocType, EngineClause } from "@/types/case-qa";

/**
 * Điều khoản CITABLE của một phiên — đầu vào duy nhất của engine hỏi đáp, FAQ công
 * khai và bộ chọn điều khoản ở hộp thư. Đọc qua RPC (không đọc bảng): RPC chỉ trả
 * điều khoản đã xác nhận, kể cả khi người xem là nhân viên tổ chức.
 */
export async function fetchCitableClauses(sessionId: string): Promise<EngineClause[]> {
  const { data, error } = await supabase.rpc("case_citable_clauses", { _session_id: sessionId });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    clause_id: r.clause_id,
    document_id: r.document_id,
    doc_type: r.doc_type as CaseDocType,
    doc_title: r.doc_title,
    clause_ref: r.clause_ref,
    heading: r.heading ?? null,
    body: r.body,
    topics: r.topics ?? [],
    sort_order: r.sort_order,
    citable: true,
  }));
}

export function useCitableClauses(sessionId?: string | null) {
  return useQuery({
    queryKey: qk.caseQa.citable(sessionId),
    enabled: !!sessionId,
    staleTime: 60_000,
    queryFn: () => fetchCitableClauses(sessionId!),
  });
}
