import { CaseDocumentsCard } from "@/components/portal/case-documents/CaseDocumentsCard";
import type { AuctionSessionWithItems } from "@/types/auction-session";

/**
 * Tab "Tài liệu phiên" — nguồn DUY NHẤT để AI trả lời câu hỏi người mua (kèm
 * trích dẫn). Tách khỏi tab Thông tin vì đây là việc riêng, làm nhiều lần và
 * thường do người khác phụ trách chứ không phải người khai báo lịch phiên.
 */
export function SessionDocumentsTab({ session, canUpdate }: { session: AuctionSessionWithItems; canUpdate: boolean }) {
  return <CaseDocumentsCard session={session} readOnly={session.status === "cancelled" || !canUpdate} />;
}
