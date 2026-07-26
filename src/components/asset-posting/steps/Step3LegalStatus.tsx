import { AlertCircle, FileText, List, ShieldCheck } from "lucide-react";
import { AssetDocUpload } from "../AssetDocUpload";
import { Group, OptionalGroup, TextField, SegYesNo, Switch, Pill } from "../fields";
import type { WizardValues } from "../wizardSchema";

interface StepProps {
  f: WizardValues;
  up: (patch: Partial<WizardValues>) => void;
  errs: Record<string, string>;
}

const LEGAL_Q: { name: "hasDispute" | "hasMortgage" | "isSeized"; label: string }[] = [
  { name: "hasDispute", label: "Tài sản có đang tranh chấp không?" },
  { name: "hasMortgage", label: "Tài sản có đang thế chấp không?" },
  { name: "isSeized", label: "Tài sản có đang bị kê biên không?" },
];

/** Bước 3: giấy tờ sở hữu + tình trạng pháp lý (3 câu) + ghi chú. */
export function Step3LegalStatus({ f, up, errs }: StepProps) {
  const answered = LEGAL_Q.filter((q) => f[q.name]).length;

  return (
    <div className="flex flex-col gap-4">
      <Group
        icon={<FileText className="h-4 w-4" />}
        title="Giấy tờ chứng minh quyền sở hữu"
        desc="Sổ đỏ / sổ hồng, đăng ký xe, hợp đồng mua bán…"
        right={f.ownershipProofUrls.length > 0 ? <Pill tone="ok">{f.ownershipProofUrls.length} tệp</Pill> : null}
      >
        <label className="block text-[13.5px] font-semibold text-foreground mb-2">
          Tải lên tối thiểu 1 tệp<span className="ml-0.5 text-destructive">*</span>
        </label>
        <AssetDocUpload value={f.ownershipProofUrls} onChange={(v) => up({ ownershipProofUrls: v })} prefix="ownership" />
        {errs.ownershipProofUrls && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-destructive mt-2.5">
            <AlertCircle className="h-3.5 w-3.5" /> {errs.ownershipProofUrls}
          </div>
        )}
      </Group>

      <Group
        icon={<ShieldCheck className="h-4 w-4" />}
        title="Tình trạng pháp lý"
        right={<Pill tone={answered === 3 ? "ok" : "muted"}>{answered}/3</Pill>}
      >
        <label className="block text-[13.5px] font-semibold text-foreground mb-1">
          Trả lời cả 3 câu<span className="ml-0.5 text-destructive">*</span>
        </label>
        {LEGAL_Q.map((q) => {
          const unanswered = !f[q.name] && !!errs.legal;
          return (
            <div
              key={q.name}
              className={`flex items-center justify-between gap-4 py-3 border-b border-dashed border-border last:border-b-0 ${
                unanswered ? "bg-warning/10 -mx-3 px-3 rounded-lg border-transparent" : ""
              }`}
            >
              <div className="text-sm font-medium text-foreground">{q.label}</div>
              <SegYesNo value={f[q.name]} onChange={(v) => up({ [q.name]: v } as Partial<WizardValues>)} />
            </div>
          );
        })}
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="text-sm font-medium text-foreground">
            Tôi có toàn quyền định đoạt / được uỷ quyền bán tài sản này
          </div>
          <Switch on={f.rightToSell} onChange={(v) => up({ rightToSell: v })} />
        </div>
        {errs.legal && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-destructive mt-3">
            <AlertCircle className="h-3.5 w-3.5" /> {errs.legal}
          </div>
        )}
      </Group>

      <OptionalGroup icon={<List className="h-4 w-4" />} title="Ghi chú pháp lý" desc="Giải chấp, tranh chấp đang xử lý…" count={1}>
        <TextField
          label="Ghi chú pháp lý"
          rows={3}
          placeholder="VD: đang trong quá trình giải chấp…"
          value={f.legalNotes ?? ""}
          onChange={(v) => up({ legalNotes: v })}
        />
      </OptionalGroup>
    </div>
  );
}
