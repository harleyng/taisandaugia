import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { EmailPreviewDialog } from "@/components/admin/marketing/EmailPreviewDialog";
import { EMAIL_VARIABLES } from "@/lib/marketing/emailVariables";
import type { CampaignFormValues } from "@/lib/marketing/campaignSchema";

interface Props {
  form: UseFormReturn<CampaignFormValues>;
  content: string;
  onContentChange: (html: string) => void;
}

export function ContentSection({ form, content, onContentChange }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const subjectLen = (form.watch("subject") ?? "").length;
  const previewLen = (form.watch("preview_text") ?? "").length;

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="subject">
            Tiêu đề email <span className="text-destructive">*</span>
          </Label>
          <span
            className={`text-xs ${subjectLen > 50 ? "text-amber-600" : "text-muted-foreground"}`}
          >
            {subjectLen}/50
          </span>
        </div>
        <Input id="subject" placeholder="Nhập tiêu đề email" {...form.register("subject")} />
        {form.formState.errors.subject && (
          <p className="text-xs text-destructive">{form.formState.errors.subject.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="preview_text">Đoạn xem trước</Label>
          <span className="text-xs text-muted-foreground">{previewLen}/140</span>
        </div>
        <Textarea
          id="preview_text"
          rows={2}
          maxLength={140}
          placeholder="Đoạn văn ngắn hiển thị dưới tiêu đề trong hộp thư"
          className="resize-none"
          {...form.register("preview_text")}
        />
        {form.formState.errors.preview_text && (
          <p className="text-xs text-destructive">{form.formState.errors.preview_text.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>
            Nội dung email <span className="text-destructive">*</span>
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-3.5 w-3.5" />
            Xem trước
          </Button>
        </div>
        <RichTextEditor
          value={content}
          onChange={onContentChange}
          placeholder="Nhập nội dung email…"
          variables={EMAIL_VARIABLES}
          enableCta
        />
      </div>

      <EmailPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        subject={form.watch("subject")}
        previewText={form.watch("preview_text")}
        contentHtml={content}
      />
    </div>
  );
}
