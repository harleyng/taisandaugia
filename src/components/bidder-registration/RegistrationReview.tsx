import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { KycImageThumb } from "@/components/ekyc/KycImageThumb";
import { formatVnd } from "@/lib/advertising/slug";
import type { RegistrationStepIndex } from "@/lib/biddingContracts/registrationSteps";
import { BUYER_KIND_LABELS } from "@/types/bidding-contract";
import { IdentitySummary } from "./IdentitySummary";
import type { StepProps } from "./types";

interface Props extends StepProps {
  orgName: string;
  fee: number;
  onEdit: (step: RegistrationStepIndex) => void;
}

function Section({ title, step, onEdit, disabled, children }: {
  title: string;
  step: RegistrationStepIndex;
  onEdit: (s: RegistrationStepIndex) => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => onEdit(step)} disabled={disabled}>
          Sửa
        </Button>
      </div>
      {children}
    </section>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="grid gap-x-4 text-sm sm:grid-cols-[10rem_1fr]">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-foreground">{value}</span>
  </div>
);

/** Bước 4 — xem lại toàn bộ + đồng ý chia sẻ thông tin ⇒ giữ chỗ ⇒ VNPay. */
export function RegistrationReview({ values, patch, errors, busy, orgName, fee, onEdit }: Props) {
  const org = values.buyer_kind === "organization";
  const o = values.organization;
  const x = values.proxy;

  return (
    <div className="space-y-4">
      <Section title="Người đăng ký" step={0} onEdit={onEdit} disabled={busy}>
        <Row label="Đăng ký với tư cách" value={BUYER_KIND_LABELS[values.buyer_kind]} />
        {org && (
          <>
            <Row label="Tên tổ chức" value={o.name} />
            <Row label="Mã số thuế" value={o.tax_code} />
            <Row label="Địa chỉ trụ sở" value={o.address} />
            {o.reg_doc_path && <KycImageThumb path={o.reg_doc_path} alt="Giấy chứng nhận ĐKKD" className="h-24 w-36" />}
          </>
        )}
        <Row label="Số điện thoại" value={values.phone} />
        <Row label="Email" value={values.email} />
      </Section>

      <Section title={org ? "Người đại diện theo pháp luật" : "Danh tính"} step={1} onEdit={onEdit} disabled={busy}>
        <IdentitySummary value={values.principal} />
      </Section>

      <Section title="Người dự phiên" step={2} onEdit={onEdit} disabled={busy}>
        {values.attendee === "self" ? (
          <p className="text-sm text-foreground">{org ? "Người đại diện theo pháp luật tự dự phiên." : "Tôi tự dự phiên."}</p>
        ) : (
          <>
            <IdentitySummary value={x} extra={[["Số điện thoại", x.phone]]} />
            {x.poa_doc_path && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Giấy uỷ quyền</p>
                <KycImageThumb path={x.poa_doc_path} alt="Giấy uỷ quyền" className="h-24 w-36" />
              </div>
            )}
          </>
        )}
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted px-4 py-3 text-sm">
        <span className="text-muted-foreground">Tiền hồ sơ</span>
        <span className="text-lg font-bold text-primary">{formatVnd(fee)}</span>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          <Checkbox
            id="reg-consent"
            checked={values.consent}
            onCheckedChange={(v) => patch({ consent: v === true })}
            disabled={busy}
            className="mt-0.5"
            aria-invalid={!!errors.root.consent}
          />
          <Label htmlFor="reg-consent" className="text-sm font-normal leading-snug">
            Tôi đồng ý chia sẻ các thông tin và ảnh giấy tờ trên với {orgName} để lập và duyệt hồ sơ tham gia đấu giá, và
            cam kết thông tin là chính xác. <span className="text-destructive">*</span>
          </Label>
        </div>
        {errors.root.consent && <p className="text-sm font-medium text-destructive">{errors.root.consent}</p>}
      </div>

      <p className="text-xs text-muted-foreground">
        Sau khi xác nhận, suất đăng ký được giữ 15 phút để bạn hoàn tất thanh toán. Tổ chức đấu giá sẽ duyệt hồ sơ sau khi
        bạn thanh toán; hồ sơ bị từ chối được hoàn tiền hồ sơ.
      </p>
    </div>
  );
}
