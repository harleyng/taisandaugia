import { useLegalConsultItems, usePostingLegalConsultations } from "@/hooks/useLegalConsultations";
import { countByStatus } from "@/lib/legalConsult/checklist";
import { summarizeConsultations } from "@/lib/legalConsult/status";

/**
 * Số mục Thiếu / Cần làm rõ của kết quả tư vấn pháp lý hiện hành — số trên tab
 * "Tư vấn pháp lý". Cùng query key với tab nên không đọc thêm lần nào.
 */
export function useLegalPendingCount(postingId: string): number {
  const { data: rows = [] } = usePostingLegalConsultations(postingId);
  const { current } = summarizeConsultations(rows);
  const { data: items = [] } = useLegalConsultItems(current?.id);
  const c = countByStatus(items);
  return current ? c.missing + c.needs_clarification : 0;
}
