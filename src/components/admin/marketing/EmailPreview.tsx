import type { ReactNode } from "react";

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-2.5">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground">{children}</span>
    </div>
  );
}

interface Props {
  subject?: string | null;
  previewText?: string | null;
  contentHtml?: string | null;
}

/** Khung xem trước email thực tế — header hộp thư + thân email ~600px canh giữa. */
export function EmailPreview({ subject, previewText, contentHtml }: Props) {
  return (
    <div className="space-y-4">
      {/* Meta — như khi mở một email trong hộp thư */}
      <div className="rounded-xl border border-border bg-muted/30 divide-y divide-border text-sm">
        <MetaRow label="Người gửi">Tài Sản Đấu Giá &lt;no-reply@taisandaugia.vn&gt;</MetaRow>
        <MetaRow label="Tiêu đề">
          <span className="font-medium">{subject || "—"}</span>
        </MetaRow>
        <MetaRow label="Xem trước">
          <span className="text-muted-foreground">{previewText || "—"}</span>
        </MetaRow>
      </div>

      {/* Thân email — khung ~600px canh giữa trên nền xám, đúng như email thật */}
      <div className="rounded-xl border border-border bg-muted/40 p-4 sm:p-8">
        {contentHtml ? (
          <div className="mx-auto max-w-[600px] rounded-lg bg-white p-6 shadow-sm">
            <div
              className="prose prose-sm max-w-none text-slate-800 [&_img]:rounded-lg [&_h2]:text-slate-900 [&_h3]:text-slate-900 [&_strong]:text-slate-900"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          </div>
        ) : (
          <p className="py-8 text-center text-sm italic text-muted-foreground">Chưa có nội dung.</p>
        )}
      </div>
    </div>
  );
}
