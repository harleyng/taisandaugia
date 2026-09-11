import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoBox } from "@/components/shared/InfoBox";
import { CASE_DOC_ACCEPT, useSaveCaseDocumentFile, validateCaseDocFile } from "@/hooks/useCaseDocuments";
import { DOC_TYPE_HINTS, DOC_TYPE_LABELS } from "@/lib/caseQa/labels";
import type { UploadableDocType } from "@/types/case-qa";
import type { CaseDocument } from "@/types/case-chat";

interface Props {
  session: { id: string; organization_id: string };
  docType: UploadableDocType;
  existing: CaseDocument | null;
  onClose: () => void;
}

/** Tải lên / thay tệp một tài liệu phiên. Parent chỉ mount khi mở ⇒ state luôn mới. */
export function UploadCaseDocumentDialog({ session, docType, existing, onClose }: Props) {
  const save = useSaveCaseDocumentFile();
  const [title, setTitle] = useState(existing?.title ?? DOC_TYPE_LABELS[docType]);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const titleOk = title.trim().length >= 3 && title.trim().length <= 200;

  const submit = () => {
    if (!file || !titleOk) return;
    save.mutate({ session, docType, title, file, existing }, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Thay tệp" : "Tải lên"} · {DOC_TYPE_LABELS[docType]}</DialogTitle>
          <DialogDescription>{DOC_TYPE_HINTS[docType]}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="case-doc-title">Tên tài liệu (hiện trong dòng “Căn cứ”)</Label>
            <Input
              id="case-doc-title"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Vd: Quy chế cuộc đấu giá số 12/2026/QC"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="case-doc-file">Tệp PDF / JPG / PNG, tối đa 10MB</Label>
            <Input
              id="case-doc-file"
              type="file"
              accept={CASE_DOC_ACCEPT.join(",")}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                setFileError(f ? validateCaseDocFile(f) : null);
              }}
            />
            {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          </div>
          {existing && (
            <InfoBox variant="amber" className="text-xs">
              Thay tệp sẽ đưa tài liệu và mọi điều khoản đã xác nhận về NHÁP — AI tạm ngừng trích dẫn tài liệu này cho tới
              khi bạn đối chiếu và xác nhận lại.
            </InfoBox>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={!file || !!fileError || !titleOk || save.isPending} className="gap-1.5">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {existing ? "Thay tệp" : "Tải lên"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
