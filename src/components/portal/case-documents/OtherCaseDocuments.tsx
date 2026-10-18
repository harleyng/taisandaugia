import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DOC_TYPE_HINTS } from "@/lib/caseQa/labels";
import type { AuctionSessionWithItems } from "@/types/auction-session";
import type { CaseDocumentWithClauses } from "@/types/case-chat";
import { CaseDocumentSlot } from "./CaseDocumentSlot";
import { UploadCaseDocumentDialog } from "./UploadCaseDocumentDialog";

interface Props {
  session: AuctionSessionWithItems;
  docs: CaseDocumentWithClauses[];
  readOnly: boolean;
}

/**
 * Khu "Tài liệu khác" — giấy tờ ngoài bốn loại cố định, mỗi phiên được nhiều tài
 * liệu (chỉ mục duy nhất loại trừ `other`, mig 20261018170000). Mỗi tài liệu đi
 * cùng vòng đời tải tệp → điều khoản → xác nhận như bốn ô trên.
 */
export function OtherCaseDocuments({ session, docs, readOnly }: Props) {
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Tài liệu khác{docs.length > 0 ? ` (${docs.length})` : ""}
          </h3>
          <p className="text-xs text-muted-foreground">{DOC_TYPE_HINTS.other}</p>
        </div>
        {!readOnly && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            Thêm tài liệu
          </Button>
        )}
      </div>

      {docs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          Chưa có tài liệu khác.
        </p>
      ) : (
        docs.map((d) => <CaseDocumentSlot key={d.id} session={session} docType="other" doc={d} readOnly={readOnly} />)
      )}

      {adding && (
        <UploadCaseDocumentDialog session={session} docType="other" existing={null} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}
