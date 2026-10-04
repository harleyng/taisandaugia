import { Field, Switch, TextField } from "../../fields";
import { OwnerPartnerSelect } from "../../partners/OwnerPartnerSelect";
import { groupNumber, parseNumber } from "../../format";
import { withIssuedAt, type AppraisalDraft } from "@/lib/dossier/draft";
import { DateField } from "./DateField";
import { DossierEvidenceUpload } from "./DossierEvidenceUpload";

interface AppraisalFieldsProps {
  value: AppraisalDraft;
  onChange: (patch: Partial<AppraisalDraft>) => void;
  postingId: string | null;
  resolvePostingId?: () => Promise<string | null>;
  /** Hiện lỗi trường bắt buộc (sau khi bấm lưu). */
  showErrors?: boolean;
  disabled?: boolean;
}

/** "Đối tác riêng" — kết quả thẩm định giá do đơn vị thẩm định của chủ thực hiện. */
export function AppraisalFields({ value: a, onChange, postingId, resolvePostingId, showErrors, disabled }: AppraisalFieldsProps) {
  const err = (missing: boolean) => (showErrors && missing ? "Bắt buộc" : undefined);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Đơn vị thẩm định giá" req err={err(!a.partnerId && !a.partnerName.trim())}>
          <OwnerPartnerSelect
            kind="appraisal"
            partnerId={a.partnerId}
            partnerName={a.partnerName}
            onChange={(p) => onChange({ partnerId: p.id, partnerName: p.name })}
            invalid={!!err(!a.partnerId && !a.partnerName.trim())}
            disabled={disabled}
          />
        </Field>
        <TextField
          label="Giá trị thẩm định"
          req
          type="number"
          unit="VNĐ"
          placeholder="0"
          value={groupNumber(a.value)}
          onChange={(v) => onChange({ value: parseNumber(v) })}
          err={err(!(Number(a.value) > 0))}
        />
        <DateField
          label="Ngày chứng thư"
          value={a.issuedAt}
          onChange={(v) => onChange(withIssuedAt(a, v))}
          disabled={disabled}
        />
        <DateField
          label="Hiệu lực đến"
          value={a.validUntil}
          onChange={(v) => onChange({ validUntil: v })}
          disabled={disabled}
        />
      </div>
      <div>
        <label className="mb-2 block text-[13.5px] font-semibold text-foreground">Chứng thư thẩm định giá</label>
        <DossierEvidenceUpload
          kind="appraisal"
          value={a.evidence}
          onChange={(v) => onChange({ evidence: v })}
          postingId={postingId}
          resolvePostingId={resolvePostingId}
          disabled={disabled}
        />
      </div>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-3.5 py-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">Hiển thị giá thẩm định công khai</div>
          <div className="text-xs text-muted-foreground">Mặc định ẩn. Bật để người mua thấy “Giá thẩm định” trên tin đấu giá.</div>
        </div>
        <Switch on={a.showValue} onChange={(v) => !disabled && onChange({ showValue: v })} />
      </div>
    </div>
  );
}
