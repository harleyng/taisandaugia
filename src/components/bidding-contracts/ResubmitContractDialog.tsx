import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { InfoBox } from "@/components/shared/InfoBox";
import { IdentityCapture, type IdentityCaptureErrors } from "@/components/ekyc/IdentityCapture";
import { useResubmitContract } from "@/hooks/useBiddingContracts";
import { useKycProfile } from "@/hooks/useKycProfile";
import { makeRegistrationSchema, toStartPayload, type RegistrationFormValues } from "@/lib/biddingContracts/registrationForm";
import { contractToFormValues, groupIssues, hasIssues, type GroupedIssues } from "@/lib/biddingContracts/resubmitForm";
import { discardKycFiles } from "@/lib/ekyc/uploadKycImage";
import type { BiddingContract } from "@/types/bidding-contract";
import { KycDocumentSlot } from "./KycDocumentSlot";

interface Props {
  contract: BiddingContract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function TextField(props: {
  id: string;
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  inputMode?: "numeric" | "email" | "tel";
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.id}>
        {props.label} <span className="text-destructive">*</span>
      </Label>
      <Input
        id={props.id}
        value={props.value}
        inputMode={props.inputMode}
        disabled={props.disabled}
        aria-invalid={!!props.error}
        onChange={(e) => props.onChange(e.target.value)}
      />
      {props.error && <p className="text-sm font-medium text-destructive">{props.error}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="border-b border-border pb-1.5 text-sm font-semibold text-foreground">{children}</h3>;
}

/**
 * Bổ sung hồ sơ theo yêu cầu của tổ chức đấu giá (review_status 'needs_info').
 * Điền sẵn bản chụp đang nộp; loại người đăng ký giữ nguyên (đổi cá nhân ⇄ tổ
 * chức là một hồ sơ khác), người dự phiên đổi được. Nộp lại ⇒ quay về "Chờ duyệt".
 */
export function ResubmitContractDialog({ contract, open, onOpenChange }: Props) {
  const resubmit = useResubmitContract();
  const { data: saved } = useKycProfile();
  const [values, setValues] = useState<RegistrationFormValues>(() => contractToFormValues(contract));
  const [errors, setErrors] = useState<GroupedIssues | null>(null);
  // Ai đang tải ảnh / đọc mã — mỗi ô báo riêng nên không cộng trừ lẫn nhau.
  const [busyBy, setBusyBy] = useState<Record<string, boolean>>({});
  // Tệp tải trong lượt mở này — huỷ thì dọn, nộp xong thì dọn phần không dùng.
  const uploads = useRef<string[]>([]);

  const schema = useMemo(
    () => makeRegistrationSchema({ vneid: saved?.source === "vneid" ? saved : null }),
    [saved],
  );

  useEffect(() => {
    if (!open) return;
    setValues(contractToFormValues(contract));
    setErrors(null);
    setBusyBy({});
    uploads.current = [];
    resubmit.reset();
    // Chỉ nạp lại khi mở dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const busy = Object.values(busyBy).some(Boolean) || resubmit.isPending;
  const org = values.buyer_kind === "organization";

  const update = (next: RegistrationFormValues) => {
    setValues(next);
    // Đã bấm nộp một lần ⇒ kiểm lại ngay để lỗi biến mất khi sửa xong.
    if (errors) {
      const r = schema.safeParse(next);
      setErrors(r.success ? null : groupIssues(r.error.issues));
    }
  };
  const patch = (p: Partial<RegistrationFormValues>) => update({ ...values, ...p });

  const onUploaded = useCallback((path: string) => uploads.current.push(path), []);
  const busyHandlers = useMemo(() => {
    const make = (key: string) => (b: boolean) => setBusyBy((m) => (m[key] === b ? m : { ...m, [key]: b }));
    return { principal: make("principal"), proxy: make("proxy"), regDoc: make("regDoc"), poa: make("poa") };
  }, []);

  const close = (next: boolean) => {
    if (next || busy) return;
    void discardKycFiles(uploads.current);
    uploads.current = [];
    onOpenChange(false);
  };

  const submit = () => {
    const r = schema.safeParse(values);
    if (!r.success) {
      const g = groupIssues(r.error.issues);
      if (hasIssues(g)) {
        setErrors(g);
        return;
      }
    }
    const payload = toStartPayload(values);
    resubmit.mutate(
      { contractId: contract.id, payload },
      {
        onSuccess: () => {
          const p = payload.principal;
          const x = payload.proxy;
          const kept = new Set([
            p.id_front_path, p.id_back_path, payload.organization?.reg_doc_path,
            x?.id_front_path, x?.id_back_path, x?.poa_doc_path,
          ]);
          void discardKycFiles(uploads.current.filter((u) => !kept.has(u)));
          uploads.current = [];
          onOpenChange(false);
        },
      },
    );
  };

  const e = errors ?? { root: {}, principal: {}, organization: {}, proxy: {} };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bổ sung hồ sơ {contract.code}</DialogTitle>
          <DialogDescription>Sửa thông tin hoặc chụp lại giấy tờ theo yêu cầu, rồi nộp lại để tổ chức duyệt.</DialogDescription>
        </DialogHeader>

        {contract.review_note && (
          <InfoBox variant="amber" className="text-sm">
            <p className="font-medium">Tổ chức đấu giá yêu cầu bổ sung</p>
            <p className="whitespace-pre-line">{contract.review_note}</p>
          </InfoBox>
        )}

        <div className="space-y-5">
          <section className="space-y-3">
            <SectionTitle>Liên hệ</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField id="rs-phone" label="Số điện thoại" inputMode="tel" value={values.phone} error={e.root.phone} disabled={busy} onChange={(v) => patch({ phone: v })} />
              <TextField id="rs-email" label="Email" inputMode="email" value={values.email} error={e.root.email} disabled={busy} onChange={(v) => patch({ email: v })} />
            </div>
          </section>

          {org && (
            <section className="space-y-3">
              <SectionTitle>Tổ chức</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField id="rs-org-name" label="Tên tổ chức" value={values.organization.name} error={e.organization.name} disabled={busy}
                  onChange={(v) => patch({ organization: { ...values.organization, name: v } })} />
                <TextField id="rs-org-tax" label="Mã số thuế" inputMode="numeric" value={values.organization.tax_code} error={e.organization.tax_code} disabled={busy}
                  onChange={(v) => patch({ organization: { ...values.organization, tax_code: v } })} />
              </div>
              <TextField id="rs-org-addr" label="Địa chỉ trụ sở" value={values.organization.address} error={e.organization.address} disabled={busy}
                onChange={(v) => patch({ organization: { ...values.organization, address: v } })} />
              <KycDocumentSlot
                label="Giấy chứng nhận đăng ký doanh nghiệp"
                required
                path={values.organization.reg_doc_path}
                error={e.organization.reg_doc_path}
                disabled={busy}
                onChange={(p) => patch({ organization: { ...values.organization, reg_doc_path: p } })}
                onUploaded={onUploaded}
                onBusyChange={busyHandlers.regDoc}
              />
            </section>
          )}

          <section className="space-y-3">
            <SectionTitle>{org ? "Người đại diện theo pháp luật" : "Danh tính người đăng ký"}</SectionTitle>
            <IdentityCapture
              value={values.principal}
              onChange={(next) => patch({ principal: next })}
              errors={e.principal as IdentityCaptureErrors}
              disabled={resubmit.isPending}
              onUploaded={onUploaded}
              onBusyChange={busyHandlers.principal}
            />
          </section>

          <section className="space-y-3">
            <SectionTitle>Người dự phiên</SectionTitle>
            <RadioGroup
              value={values.attendee}
              onValueChange={(v) => patch({ attendee: v as RegistrationFormValues["attendee"] })}
              className="gap-2"
              disabled={busy}
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="self" />
                {org ? "Người đại diện theo pháp luật tự dự phiên" : "Tôi tự dự phiên"}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="proxy" />
                Uỷ quyền cho người khác dự phiên
              </label>
            </RadioGroup>

            {values.attendee === "proxy" && (
              <div className="space-y-3 rounded-xl border border-border p-4">
                <IdentityCapture
                  value={values.proxy}
                  onChange={(next) => patch({ proxy: { ...values.proxy, ...next } })}
                  errors={e.proxy as IdentityCaptureErrors}
                  disabled={resubmit.isPending}
                  onUploaded={onUploaded}
                  onBusyChange={busyHandlers.proxy}
                />
                <TextField id="rs-proxy-phone" label="Số điện thoại người được uỷ quyền" inputMode="tel" value={values.proxy.phone}
                  error={e.proxy.phone} disabled={busy} onChange={(v) => patch({ proxy: { ...values.proxy, phone: v } })} />
                <KycDocumentSlot
                  label="Giấy uỷ quyền"
                  required
                  path={values.proxy.poa_doc_path}
                  error={e.proxy.poa_doc_path}
                  disabled={busy}
                  onChange={(p) => patch({ proxy: { ...values.proxy, poa_doc_path: p } })}
                  onUploaded={onUploaded}
                  onBusyChange={busyHandlers.poa}
                />
              </div>
            )}
          </section>
        </div>

        {errors && hasIssues(errors) && (
          <p className="text-sm font-medium text-destructive">Kiểm tra lại các trường được đánh dấu.</p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => close(false)} disabled={busy}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={busy} className="gap-1.5">
            {resubmit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Nộp lại hồ sơ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
