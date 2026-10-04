import { AlertCircle } from "lucide-react";
import { Field, TextField } from "../../fields";
import { OwnerPartnerSelect } from "../../partners/OwnerPartnerSelect";
import type { LegalDraft } from "@/lib/dossier/draft";
import { LEGAL_CONCLUSION_LABEL, type LegalConclusion } from "@/lib/dossier/types";
import { DossierEvidenceUpload } from "./DossierEvidenceUpload";
import { Segmented } from "./Segmented";

interface LegalFieldsProps {
  value: LegalDraft;
  onChange: (patch: Partial<LegalDraft>) => void;
  postingId: string | null;
  resolvePostingId?: () => Promise<string | null>;
  showErrors?: boolean;
  disabled?: boolean;
}

const CONCLUSIONS = (Object.keys(LEGAL_CONCLUSION_LABEL) as LegalConclusion[]).map((v) => ({
  value: v,
  label: LEGAL_CONCLUSION_LABEL[v],
}));

/** "Đối tác riêng" — ý kiến pháp lý của luật sư / công ty luật của chủ. */
export function LegalFields({ value: l, onChange, postingId, resolvePostingId, showErrors, disabled }: LegalFieldsProps) {
  const err = (missing: boolean) => (showErrors && missing ? "Bắt buộc" : undefined);
  return (
    <div className="flex flex-col gap-4">
      <Field label="Đơn vị tư vấn pháp lý" req err={err(!l.partnerId && !l.partnerName.trim())}>
        <OwnerPartnerSelect
          kind="legal"
          partnerId={l.partnerId}
          partnerName={l.partnerName}
          onChange={(p) => onChange({ partnerId: p.id, partnerName: p.name })}
          invalid={!!err(!l.partnerId && !l.partnerName.trim())}
          disabled={disabled}
        />
      </Field>
      <div className="flex flex-col gap-2">
        <label className="text-[13.5px] font-semibold text-foreground">
          Kết luận<span className="ml-0.5 text-destructive">*</span>
        </label>
        <div>
          <Segmented
            ariaLabel="Kết luận pháp lý"
            options={CONCLUSIONS.map((o) => ({ ...o, disabled }))}
            value={l.conclusion}
            onChange={(v) => onChange({ conclusion: v })}
          />
        </div>
        {showErrors && !l.conclusion && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> Bắt buộc
          </div>
        )}
      </div>
      {l.conclusion === "has_issues" && (
        <TextField
          label="Tóm tắt vướng mắc"
          req
          rows={3}
          placeholder="VD: Đang thế chấp tại ngân hàng, cần giải chấp trước khi chuyển nhượng…"
          value={l.summary}
          onChange={(v) => onChange({ summary: v })}
          err={err(!l.summary.trim())}
        />
      )}
      <div>
        <label className="mb-2 block text-[13.5px] font-semibold text-foreground">Văn bản ý kiến pháp lý</label>
        <DossierEvidenceUpload
          kind="legal"
          value={l.evidence}
          onChange={(v) => onChange({ evidence: v })}
          postingId={postingId}
          resolvePostingId={resolvePostingId}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
