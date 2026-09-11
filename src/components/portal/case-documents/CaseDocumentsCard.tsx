import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCaseDocuments } from "@/hooks/useCaseDocuments";
import { UPLOADABLE_DOC_TYPES } from "@/lib/caseQa/labels";
import type { AuctionSessionWithItems } from "@/types/auction-session";
import { CaseDocumentSlot } from "./CaseDocumentSlot";
import { QaCoverageCard } from "./QaCoverageCard";
import { SessionEscalationsMini } from "./SessionEscalationsMini";

interface Props {
  session: AuctionSessionWithItems;
  readOnly: boolean;
}

/** "Tài liệu phiên cho hỏi đáp" trên trang chi tiết phiên ở portal. */
export function CaseDocumentsCard({ session, readOnly }: Props) {
  const navigate = useNavigate();
  const { data: docs = [], isLoading } = useCaseDocuments(session.id);
  const byType = new Map(docs.map((d) => [d.doc_type, d]));
  const clarification = byType.get("clarification");

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">Tài liệu phiên cho hỏi đáp</h2>
          <p className="text-xs text-muted-foreground">
            AI chỉ trả lời người mua bằng điều khoản ĐÃ XÁC NHẬN ở đây, luôn kèm trích dẫn. Điều tài liệu chưa nêu sẽ
            chuyển cho chuyên viên.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => navigate(`/portal/phien-dau-gia/${session.id}/hoi-dap`)}
        >
          <Eye className="h-4 w-4" />
          Xem trước trang hỏi đáp
        </Button>
      </div>

      <QaCoverageCard sessionId={session.id} sessionCode={session.code ?? ""} />

      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (
        <div className="space-y-3">
          {UPLOADABLE_DOC_TYPES.map((t) => (
            <CaseDocumentSlot key={t} session={session} docType={t} doc={byType.get(t) ?? null} readOnly={readOnly} />
          ))}
          {clarification && (
            <CaseDocumentSlot session={session} docType="clarification" doc={clarification} readOnly={readOnly} />
          )}
        </div>
      )}

      <SessionEscalationsMini sessionId={session.id} />
    </Card>
  );
}
