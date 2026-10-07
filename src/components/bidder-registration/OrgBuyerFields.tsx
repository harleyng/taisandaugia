import { KycDocumentSlot } from "@/components/bidding-contracts/KycDocumentSlot";
import { RegField } from "./RegField";
import type { StepProps } from "./types";

/** Tổ chức đăng ký: tên, MST, trụ sở + giấy chứng nhận ĐKKD (B1). */
export function OrgBuyerFields({ values, patch, errors, busy, onUploaded, busyHandlers }: StepProps) {
  const o = values.organization;
  const e = errors.organization;
  const set = (p: Partial<typeof o>) => patch({ organization: { ...o, ...p } });

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <RegField id="reg-org-name" label="Tên tổ chức" className="sm:col-span-2" value={o.name} error={e.name} disabled={busy}
          onChange={(v) => set({ name: v })} />
        <RegField id="reg-org-tax" label="Mã số thuế" inputMode="numeric" placeholder="10 hoặc 13 chữ số" value={o.tax_code}
          error={e.tax_code} disabled={busy} onChange={(v) => set({ tax_code: v })} />
        <RegField id="reg-org-addr" label="Địa chỉ trụ sở" value={o.address} error={e.address} disabled={busy}
          onChange={(v) => set({ address: v })} />
      </div>
      <KycDocumentSlot
        label="Giấy chứng nhận đăng ký doanh nghiệp"
        required
        path={o.reg_doc_path}
        error={e.reg_doc_path}
        disabled={busy}
        onChange={(p) => set({ reg_doc_path: p })}
        onUploaded={onUploaded}
        onBusyChange={busyHandlers.regDoc}
      />
    </div>
  );
}
