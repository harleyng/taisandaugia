import { useState } from "react";
import { ShieldCheck, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { InfoBox } from "@/components/shared/InfoBox";
import { IdentityCapture, type IdentityCaptureErrors } from "@/components/ekyc/IdentityCapture";
import { VneidButton } from "@/components/vneid/VneidButton";
import { VneidConsentDialog } from "@/components/vneid/VneidConsentDialog";
import { SAVED_IDENTITY_SOURCE_LABELS, type VerifiedIdentity } from "@/types/bidding-contract";
import { IdentitySummary } from "./IdentitySummary";
import type { StepProps } from "./types";

interface Props extends StepProps {
  saved: VerifiedIdentity | null;
  /** Đang dùng nguyên danh tính đã lưu (không chụp lại). */
  usingSaved: boolean;
  onUseSaved: (identity: VerifiedIdentity) => void;
  onUseOther: () => void;
  /** Lần KYC đầu của người đăng ký cá nhân ⇒ hỏi lưu vào hồ sơ. */
  offerSave: boolean;
  saveToProfile: boolean;
  onSaveToProfileChange: (v: boolean) => void;
}

/**
 * Bước 2 — danh tính người đăng ký (hoặc người đại diện theo pháp luật). Có danh
 * tính đã lưu ⇒ dùng lại, khỏi chụp; chưa có ⇒ chụp CCCD (đọc QR) hoặc VNeID.
 */
export function IdentityStep(props: Props) {
  const { values, patch, errors, submitting, onUploaded, busyHandlers, saved, usingSaved } = props;
  const [vneidOpen, setVneidOpen] = useState(false);
  const org = values.buyer_kind === "organization";
  const savedErrors = Object.values(errors.principal);

  return (
    <div className="space-y-5">
      {org && (
        <InfoBox variant="muted" className="text-sm text-muted-foreground">
          Kê khai danh tính của <span className="font-medium text-foreground">người đại diện theo pháp luật</span> của tổ
          chức. Nếu bạn không phải người đó, chọn "Dùng giấy tờ khác" và chụp giấy tờ của họ.
        </InfoBox>
      )}

      {usingSaved && saved ? (
        <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-medium text-primary">
              {saved.source === "vneid" ? <ShieldCheck className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
              Danh tính đã lưu ({SAVED_IDENTITY_SOURCE_LABELS[saved.source]}) — không cần chụp lại giấy tờ
            </span>
            <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={props.onUseOther} disabled={submitting}>
              Dùng giấy tờ khác
            </Button>
          </div>
          <IdentitySummary value={values.principal} />
          {savedErrors.length > 0 && (
            <InfoBox variant="amber" className="space-y-1 text-sm">
              <p className="font-medium">Danh tính đã lưu chưa đủ để đăng ký:</p>
              <ul className="list-disc pl-5">
                {savedErrors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
              <p>Chọn "Dùng giấy tờ khác" để chụp lại.</p>
            </InfoBox>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border px-4 py-3">
            <div className="text-sm">
              <p className="font-medium text-foreground">{saved ? "Bạn đã lưu danh tính trên tài khoản" : "Điền nhanh bằng VNeID"}</p>
              <p className="text-xs text-muted-foreground">
                {saved
                  ? "Dùng lại để khỏi chụp giấy tờ."
                  : "Họ tên, CCCD, ngày sinh, nơi thường trú được lấy từ ứng dụng định danh."}
              </p>
            </div>
            {saved ? (
              <Button type="button" variant="outline" size="sm" onClick={() => props.onUseSaved(saved)} disabled={submitting}>
                Dùng danh tính đã lưu
              </Button>
            ) : (
              <VneidButton size="sm" onClick={() => setVneidOpen(true)} disabled={submitting} />
            )}
          </div>

          <IdentityCapture
            value={values.principal}
            onChange={(next) => patch({ principal: next })}
            errors={errors.principal as IdentityCaptureErrors}
            disabled={submitting}
            dobRequired={props.offerSave && props.saveToProfile}
            onUploaded={onUploaded}
            onBusyChange={busyHandlers.principal}
          />

          {props.offerSave && (
            <div className="flex items-start gap-2">
              <Checkbox
                id="reg-save-profile"
                checked={props.saveToProfile}
                onCheckedChange={(v) => props.onSaveToProfileChange(v === true)}
                disabled={submitting}
                className="mt-0.5"
              />
              <Label htmlFor="reg-save-profile" className="text-sm font-normal leading-snug">
                Lưu danh tính này vào hồ sơ của tôi để lần sau không phải chụp lại giấy tờ.
              </Label>
            </div>
          )}
        </>
      )}

      <VneidConsentDialog open={vneidOpen} onOpenChange={setVneidOpen} onLinked={props.onUseSaved} />
    </div>
  );
}
