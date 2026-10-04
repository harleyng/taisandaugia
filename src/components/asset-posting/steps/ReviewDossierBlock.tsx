import { AlertTriangle, Handshake } from "lucide-react";
import { incompleteKinds, type DossierDraft } from "@/lib/dossier/draft";
import { AUTH_VERDICT_LABEL, DOSSIER_KIND_LABEL, LEGAL_CONCLUSION_LABEL, SOURCE_LABEL, type DossierKind } from "@/lib/dossier/types";
import { groupNumber } from "../format";

interface ReviewDossierBlockProps {
  draft: DossierDraft;
  jump: (step: number) => void;
}

/** Thứ tự theo bước của wizard: pháp lý (bước 3) → thẩm định giá, giám định (bước 4). Đấu giá không có lựa chọn đối tác. */
const KINDS: DossierKind[] = ["legal", "appraisal", "authentication"];
const STEP_OF: Record<DossierKind, number> = { legal: 3, appraisal: 4, authentication: 4, auction: 4 };

/** Bước 5 — tóm tắt lựa chọn đối tác của Pháp lý, Thẩm định giá & Giám định (đối tác riêng / dịch vụ của sàn). */
export function ReviewDossierBlock({ draft, jump }: ReviewDossierBlockProps) {
  const incomplete = incompleteKinds(draft);

  const summary = (kind: DossierKind): string => {
    const src = draft[kind].source;
    if (src === "marketplace") return SOURCE_LABEL.marketplace;
    if (src !== "external_partner") return "Chưa chọn";
    const name = draft[kind].partnerName.trim();
    const parts: (string | false | 0)[] = [`${SOURCE_LABEL.external_partner}: ${name}`];
    if (kind === "appraisal") {
      const a = draft.appraisal;
      parts.push(a.value && `${groupNumber(a.value)} VNĐ`, a.evidence.length && `${a.evidence.length} tệp`);
    } else if (kind === "authentication") {
      const g = draft.authentication;
      parts.push(g.verdict && AUTH_VERDICT_LABEL[g.verdict], g.evidence.length && `${g.evidence.length} tệp`);
    } else if (kind === "legal") {
      const l = draft.legal;
      parts.push(l.conclusion && LEGAL_CONCLUSION_LABEL[l.conclusion], l.evidence.length && `${l.evidence.length} tệp`);
    }
    return parts.filter(Boolean).join(" · ");
  };

  return (
    <div className={`overflow-hidden rounded-xl border bg-card ${incomplete.length ? "border-warning/40" : "border-border"}`}>
      <div className="flex items-center gap-2.5 border-b border-border bg-muted/20 px-4 py-3">
        <Handshake className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
        <h3 className="flex-1 text-[13.5px] font-semibold text-foreground">Đối tác & dịch vụ</h3>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 px-4 py-3.5 text-[13.5px] sm:grid-cols-[180px_1fr_auto]">
        {KINDS.map((k) => (
          <div key={k} className="contents">
            <div className="text-xs text-muted-foreground sm:pt-0.5">{DOSSIER_KIND_LABEL[k]}</div>
            {incomplete.includes(k) ? (
              <div className="flex items-center gap-1.5 font-semibold text-warning">
                <AlertTriangle className="h-3.5 w-3.5" /> Đối tác riêng — chưa đủ thông tin, chưa lưu
              </div>
            ) : (
              <div className={draft[k].source ? "font-medium text-foreground" : "text-muted-foreground"}>{summary(k)}</div>
            )}
            <button
              type="button"
              onClick={() => jump(STEP_OF[k])}
              className="justify-self-start rounded-lg px-2 py-0.5 text-[13px] font-semibold text-primary transition hover:bg-primary/5"
            >
              Sửa
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
