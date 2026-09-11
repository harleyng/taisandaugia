import { useState } from "react";
import { ChevronDown, ExternalLink, FileText, FlaskConical, RotateCcw, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useCaseDocumentExtraction } from "@/hooks/useCaseDocumentExtraction";
import {
  signCaseDocumentUrl,
  useDeleteCaseDocument,
  useSaveExtractedClauses,
  useSetCaseDocumentReview,
} from "@/hooks/useCaseDocuments";
import { caseQaErrorMessage } from "@/lib/caseQa/errors";
import { DOC_TYPE_HINTS, DOC_TYPE_LABELS } from "@/lib/caseQa/labels";
import type { CaseDocType } from "@/types/case-qa";
import type { AuctionSessionWithItems } from "@/types/auction-session";
import type { CaseDocumentWithClauses } from "@/types/case-chat";
import { ClauseReviewTable } from "./ClauseReviewTable";
import { ConfirmDocumentDialog } from "./ConfirmDocumentDialog";
import { ExtractionProgress } from "./ExtractionProgress";
import { toExtractionLots, toExtractionSession } from "./extractionInput";
import { UploadCaseDocumentDialog } from "./UploadCaseDocumentDialog";

interface Props {
  session: AuctionSessionWithItems;
  docType: CaseDocType;
  doc: CaseDocumentWithClauses | null;
  readOnly: boolean;
}

type DialogKind = "upload" | "confirm" | "delete" | null;

export function CaseDocumentSlot({ session, docType, doc, readOnly }: Props) {
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [open, setOpen] = useState(false);
  const extraction = useCaseDocumentExtraction();
  const saveExtracted = useSaveExtractedClauses();
  const review = useSetCaseDocumentReview();
  const remove = useDeleteCaseDocument();

  const clauses = doc?.case_document_clauses ?? [];
  const drafts = clauses.filter((c) => c.status === "draft").length;
  const isClarification = docType === "clarification";
  const confirmed = doc?.review_status === "confirmed";
  const running = extraction.state.phase === "running";

  const runExtraction = () => {
    if (!doc || docType === "clarification") return;
    setOpen(true);
    extraction.run(
      {
        documentId: doc.id,
        docType,
        session: toExtractionSession(session),
        orgName: null,
        lots: toExtractionLots(session),
      },
      (result) =>
        saveExtracted.mutateAsync({
          sessionId: session.id,
          documentId: doc.id,
          clauses: result.clauses,
          engine: result.engine,
        }),
    );
  };

  const openFile = () => {
    if (!doc?.storage_path) return;
    signCaseDocumentUrl(doc.storage_path)
      .then((url) => window.open(url, "_blank", "noopener,noreferrer"))
      .catch((err) => toast.error(caseQaErrorMessage(err)));
  };

  const statusBadge = !doc ? (
    <Badge variant="outline" className="text-[11px] text-muted-foreground">
      Chưa có
    </Badge>
  ) : isClarification ? (
    <Badge variant="outline" className="text-[11px]">
      Xác nhận theo từng điều khoản
    </Badge>
  ) : confirmed ? (
    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[11px] text-primary">
      Đã xác nhận{drafts > 0 ? ` · ${drafts} điều khoản nháp` : ""}
    </Badge>
  ) : (
    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[11px] text-amber-800">
      Nháp · {clauses.length} điều khoản
    </Badge>
  );

  return (
    <div className="rounded-xl border border-border">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="font-medium text-foreground">{DOC_TYPE_LABELS[docType]}</p>
            {statusBadge}
            {doc?.extraction_engine && (
              <Badge variant="outline" className="gap-1 text-[11px]" title="Điều khoản dựng từ dữ liệu phiên, không đọc nội dung tệp">
                <FlaskConical className="h-3 w-3" />
                Trích xuất giả lập
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {doc ? `${doc.title}${doc.original_filename ? ` · ${doc.original_filename}` : ""}` : DOC_TYPE_HINTS[docType]}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {doc?.storage_path && (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={openFile}>
              <ExternalLink className="h-4 w-4" />
              Mở tệp
            </Button>
          )}
          {!readOnly && !isClarification && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDialog("upload")}>
              <Upload className="h-4 w-4" />
              {doc ? "Thay tệp" : "Tải tài liệu lên"}
            </Button>
          )}
          {!readOnly && doc && !isClarification && !confirmed && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={runExtraction}
              disabled={running}
              title="Thay các điều khoản trích xuất còn nháp; điều khoản nhập tay giữ nguyên"
            >
              <Sparkles className="h-4 w-4" />
              Trích xuất điều khoản
            </Button>
          )}
          {!readOnly && doc && !isClarification && !confirmed && (
            <Button size="sm" onClick={() => setDialog("confirm")} disabled={clauses.length === 0 || drafts > 0}>
              Xác nhận tài liệu
            </Button>
          )}
          {!readOnly && doc && !isClarification && confirmed && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              disabled={review.isPending}
              onClick={() => review.mutate({ doc, status: "draft" })}
            >
              <RotateCcw className="h-4 w-4" />
              Mở lại
            </Button>
          )}
          {!readOnly && doc && (
            <Button variant="ghost" size="icon" onClick={() => setDialog("delete")} aria-label="Xoá tài liệu">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </div>

      <ExtractionProgress state={extraction.state} progress={extraction.progress} onDismiss={extraction.reset} />

      {doc && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between border-t border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            <span>
              Điều khoản ({clauses.length}
              {drafts > 0 ? ` · ${drafts} nháp` : ""})
            </span>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ClauseReviewTable doc={doc} readOnly={readOnly} />
          </CollapsibleContent>
        </Collapsible>
      )}

      {dialog === "upload" && docType !== "clarification" && (
        <UploadCaseDocumentDialog session={session} docType={docType} existing={doc} onClose={() => setDialog(null)} />
      )}
      {dialog === "confirm" && doc && <ConfirmDocumentDialog doc={doc} onClose={() => setDialog(null)} />}
      {doc && (
        <AlertDialog open={dialog === "delete"} onOpenChange={(v) => !v && setDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Xoá {DOC_TYPE_LABELS[docType].toLowerCase()}?</AlertDialogTitle>
              <AlertDialogDescription>
                Xoá tệp và {clauses.length} điều khoản. Các câu trả lời đã gửi trích dẫn tài liệu này sẽ hiện “tài liệu đã
                thay đổi” với người mua.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Huỷ</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => remove.mutate(doc)}
              >
                Xoá tài liệu
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
