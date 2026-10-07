import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { IdentityCapture, type IdentityCaptureErrors } from "@/components/ekyc/IdentityCapture";
import { KycDocumentSlot } from "@/components/bidding-contracts/KycDocumentSlot";
import { applySavedIdentity, type RegistrationFormValues } from "@/lib/biddingContracts/registrationForm";
import { cn } from "@/lib/utils";
import type { VerifiedIdentity } from "@/types/bidding-contract";
import { RegField } from "./RegField";
import type { StepProps } from "./types";

interface Props extends StepProps {
  saved: VerifiedIdentity | null;
  /** Người đăng ký đang dùng danh tính đã lưu ⇒ không thể đồng thời là người được uỷ quyền. */
  principalIsSaved: boolean;
}

/**
 * Bước 3 — ai dự phiên: chính người đăng ký / người đại diện theo pháp luật, hoặc
 * người được uỷ quyền (B2) ⇒ KYC thêm người đó + giấy uỷ quyền.
 */
export function ProxySection(props: Props) {
  const { values, patch, errors, busy, submitting, onUploaded, busyHandlers, saved } = props;
  const org = values.buyer_kind === "organization";
  const x = values.proxy;
  const set = (p: Partial<typeof x>) => patch({ proxy: { ...x, ...p } });

  // Nhân viên được tổ chức uỷ quyền thường là chính chủ tài khoản ⇒ dùng ảnh đã lưu.
  const canUseSavedForProxy = saved?.source === "id_photo" && !props.principalIsSaved;

  const options: { value: RegistrationFormValues["attendee"]; title: string; hint: string }[] = [
    {
      value: "self",
      title: org ? "Người đại diện theo pháp luật tự dự phiên" : "Tôi tự dự phiên",
      hint: "Mang giấy tờ gốc đã kê khai khi điểm danh",
    },
    { value: "proxy", title: "Uỷ quyền cho người khác dự phiên", hint: "Cần giấy uỷ quyền và giấy tờ tuỳ thân của người được uỷ quyền" },
  ];

  return (
    <div className="space-y-5">
      <RadioGroup
        value={values.attendee}
        onValueChange={(v) => patch({ attendee: v as RegistrationFormValues["attendee"] })}
        className="grid gap-3 sm:grid-cols-2"
        disabled={busy}
      >
        {options.map((o) => (
          <label
            key={o.value}
            htmlFor={`reg-attendee-${o.value}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
              values.attendee === o.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
            )}
          >
            <RadioGroupItem id={`reg-attendee-${o.value}`} value={o.value} className="mt-1" />
            <span>
              <span className="block font-medium text-foreground">{o.title}</span>
              <span className="block text-xs text-muted-foreground">{o.hint}</span>
            </span>
          </label>
        ))}
      </RadioGroup>

      {values.attendee === "proxy" && (
        <div className="space-y-5 rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Người được uỷ quyền</p>
            {canUseSavedForProxy && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => set({ ...applySavedIdentity(saved!), phone: x.phone || values.phone })}
              >
                Tôi là người được uỷ quyền
              </Button>
            )}
          </div>
          <IdentityCapture
            value={x}
            onChange={(next) => set(next)}
            errors={errors.proxy as IdentityCaptureErrors}
            disabled={submitting}
            onUploaded={onUploaded}
            onBusyChange={busyHandlers.proxy}
          />
          <RegField id="reg-proxy-phone" label="Số điện thoại người được uỷ quyền" inputMode="tel" placeholder="0912345678"
            value={x.phone} error={errors.proxy.phone} disabled={busy} onChange={(v) => set({ phone: v })} />
          <KycDocumentSlot
            label="Giấy uỷ quyền"
            required
            path={x.poa_doc_path}
            error={errors.proxy.poa_doc_path}
            disabled={busy}
            onChange={(p) => set({ poa_doc_path: p })}
            onUploaded={onUploaded}
            onBusyChange={busyHandlers.poa}
          />
        </div>
      )}
    </div>
  );
}
