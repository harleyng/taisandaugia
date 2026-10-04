import { AlertCircle, Info } from "lucide-react";
import { Field, TextField } from "../../fields";
import { OwnerPartnerSelect } from "../../partners/OwnerPartnerSelect";
import type { AuthenticationDraft } from "@/lib/dossier/draft";
import { AUTH_VERDICT_LABEL, type AuthVerdict } from "@/lib/dossier/types";
import { DateField } from "./DateField";
import { DossierEvidenceUpload } from "./DossierEvidenceUpload";
import { Segmented } from "./Segmented";

interface AuthenticationFieldsProps {
  value: AuthenticationDraft;
  onChange: (patch: Partial<AuthenticationDraft>) => void;
  postingId: string | null;
  resolvePostingId?: () => Promise<string | null>;
  showErrors?: boolean;
  disabled?: boolean;
}

const VERDICTS = (Object.keys(AUTH_VERDICT_LABEL) as AuthVerdict[]).map((v) => ({
  value: v,
  label: AUTH_VERDICT_LABEL[v],
}));

/** "Đối tác riêng" — kết luận giám định của đơn vị giám định do chủ tự thuê. */
export function AuthenticationFields({
  value: g,
  onChange,
  postingId,
  resolvePostingId,
  showErrors,
  disabled,
}: AuthenticationFieldsProps) {
  const err = (missing: boolean) => (showErrors && missing ? "Bắt buộc" : undefined);
  return (
    <div className="flex flex-col gap-4">
      <Field label="Đơn vị giám định" req err={err(!g.partnerId && !g.partnerName.trim())}>
        <OwnerPartnerSelect
          kind="authentication"
          partnerId={g.partnerId}
          partnerName={g.partnerName}
          onChange={(p) => onChange({ partnerId: p.id, partnerName: p.name })}
          invalid={!!err(!g.partnerId && !g.partnerName.trim())}
          disabled={disabled}
        />
      </Field>
      <div className="flex flex-col gap-2">
        <label className="text-[13.5px] font-semibold text-foreground">
          Kết luận<span className="ml-0.5 text-destructive">*</span>
        </label>
        <div>
          <Segmented
            ariaLabel="Kết luận giám định"
            options={VERDICTS.map((o) => ({ ...o, disabled }))}
            value={g.verdict}
            onChange={(v) => onChange({ verdict: v })}
          />
        </div>
        {showErrors && !g.verdict && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> Bắt buộc
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Số chứng thư"
          placeholder="VD: 125/2026/CT-GĐ"
          value={g.certificateNo}
          onChange={(v) => onChange({ certificateNo: v })}
        />
        <DateField
          label="Ngày chứng thư"
          value={g.issuedAt}
          onChange={(v) => onChange({ issuedAt: v })}
          disabled={disabled}
        />
      </div>
      <div>
        <label className="mb-2 block text-[13.5px] font-semibold text-foreground">Chứng thư giám định</label>
        <DossierEvidenceUpload
          kind="authentication"
          value={g.evidence}
          onChange={(v) => onChange({ evidence: v })}
          postingId={postingId}
          resolvePostingId={resolvePostingId}
          disabled={disabled}
        />
      </div>
      <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        Kết luận của đối tác riêng không thay chứng thư giám định bắt buộc của sàn và không nâng mức xác minh của lô.
      </p>
    </div>
  );
}
