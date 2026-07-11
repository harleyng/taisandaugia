import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmailPreview } from "./EmailPreview";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subject?: string | null;
  previewText?: string | null;
  contentHtml?: string | null;
}

export function EmailPreviewDialog({
  open,
  onOpenChange,
  subject,
  previewText,
  contentHtml,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Xem trước email</DialogTitle>
        </DialogHeader>
        <EmailPreview subject={subject} previewText={previewText} contentHtml={contentHtml} />
      </DialogContent>
    </Dialog>
  );
}
