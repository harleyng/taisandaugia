import { FileText } from "lucide-react";
import { openLegalDoc } from "@/hooks/useLegalConsultations";
import { docLabel } from "@/lib/legalConsult/paths";

/** Danh sách tệp hồ sơ (bucket private) — bấm để mở qua signed URL. */
export function LegalDocChips({ paths, empty }: { paths: string[]; empty?: string }) {
  if (paths.length === 0) return empty ? <p className="text-xs text-muted-foreground">{empty}</p> : null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {paths.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => openLegalDoc(p)}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <FileText className="h-3 w-3" /> {docLabel(p)}
        </button>
      ))}
    </div>
  );
}
