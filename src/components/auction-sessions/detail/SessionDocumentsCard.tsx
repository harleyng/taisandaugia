import { Download, FileText } from "lucide-react";
import { formatShortDate } from "@/lib/auctionSessions/listBadge";
import { openPublicSessionDocument, type PublicSessionDocument } from "@/hooks/usePublicSessionPage";
import { SectionCard } from "./ui";

const fileKind = (mime: string | null) =>
  mime === "application/pdf" ? "PDF" : mime?.startsWith("image/") ? "Ảnh" : "Tệp";

function fileSize(bytes: number | null): string | null {
  if (bytes == null) return null;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "Tài liệu phiên" — tài liệu tổ chức đã xác nhận (RPC public_session_documents). Không có thì ẩn. */
export function SessionDocumentsCard({ documents }: { documents: PublicSessionDocument[] }) {
  if (documents.length === 0) return null;
  return (
    <SectionCard icon={FileText} title="Tài liệu phiên">
      <div className="flex flex-col gap-3 px-4 pb-5">
        {documents.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => void openPublicSessionDocument(d.storage_path)}
            className="group flex items-center gap-3 rounded-xl bg-card p-3 text-left shadow-card transition-all hover:-translate-y-px hover:shadow-md"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/10">
              <FileText className="h-[18px] w-[18px] text-primary" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-foreground">{d.title}</div>
              <span className="text-xs text-muted-foreground">
                {[fileKind(d.mime_type), fileSize(d.size_bytes), formatShortDate(d.issued_at)].filter(Boolean).join(" · ")}
              </span>
            </div>
            <span
              aria-label="Tải về"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors group-hover:bg-primary"
            >
              <Download className="h-[18px] w-[18px] text-primary group-hover:text-primary-foreground" strokeWidth={1.8} />
            </span>
          </button>
        ))}
      </div>
    </SectionCard>
  );
}
