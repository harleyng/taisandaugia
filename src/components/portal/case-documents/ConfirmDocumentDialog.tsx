import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSetCaseDocumentReview } from "@/hooks/useCaseDocuments";
import type { CaseDocumentWithClauses } from "@/types/case-chat";

interface Props {
  doc: CaseDocumentWithClauses;
  onClose: () => void;
}

/** Xác nhận tài liệu = cho phép AI trích dẫn. Bắt buộc cam kết đã đối chiếu với tệp gốc. */
export function ConfirmDocumentDialog({ doc, onClose }: Props) {
  const confirm = useSetCaseDocumentReview();
  const [title, setTitle] = useState(doc.title);
  const [attested, setAttested] = useState(false);
  const titleOk = title.trim().length >= 3;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Xác nhận tài liệu phiên</DialogTitle>
          <DialogDescription>
            Sau khi xác nhận, AI được trích dẫn {doc.case_document_clauses.length} điều khoản của tài liệu này để trả lời
            người mua. Thay tệp hoặc sửa nội dung điều khoản sẽ đưa về nháp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="confirm-doc-title">Tên tài liệu dùng trong dòng “Căn cứ”</Label>
            <Input id="confirm-doc-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <label className="flex items-start gap-2 text-sm text-foreground">
            <Checkbox checked={attested} onCheckedChange={(v) => setAttested(v === true)} className="mt-0.5" />
            Tôi đã đối chiếu toàn bộ điều khoản với tệp gốc. Mọi số tiền, thời hạn và địa điểm khớp với tài liệu tổ chức
            đã phát hành.
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={confirm.isPending}>
            Huỷ
          </Button>
          <Button
            disabled={!attested || !titleOk || confirm.isPending}
            className="gap-1.5"
            onClick={() => confirm.mutate({ doc, status: "confirmed", title }, { onSuccess: onClose })}
          >
            {confirm.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Xác nhận tài liệu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
