import { useState } from "react";
import { ShieldCheck, UserCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Note } from "@/components/auction-sessions/detail/ui";
import { IdentityCapture, type IdentityCaptureErrors } from "@/components/ekyc/IdentityCapture";
import { VneidButton } from "@/components/vneid/VneidButton";
import { VneidConsentDialog } from "@/components/vneid/VneidConsentDialog";
import { InfoGrid, TagPill } from "@/components/buyer-contracts/ui";
import { ID_TYPE_LABELS, type VerifiedIdentity } from "@/types/bidding-contract";
import { StepCard } from "./StepCard";
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

const dob = (iso: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("vi-VN") : "—");
const mask = (n: string) => (n ? `••• ••• ${n.slice(-4)}` : "—");

/**
 * Bước 2 — danh tính người đăng ký (hoặc người đại diện theo pháp luật). Có danh
 * tính đã lưu ⇒ dùng lại, khỏi chụp; chưa có ⇒ chụp CCCD (đọc QR) hoặc VNeID.
 */
export function IdentityStep(props: Props) {
  const { values, patch, errors, submitting, onUploaded, busyHandlers, saved, usingSaved } = props;
  const [vneidOpen, setVneidOpen] = useState(false);
  const org = values.buyer_kind === "organization";
  const savedErrors = Object.values(errors.principal);
  const p = values.principal;
  const vneid = saved?.source === "vneid";

  return (
    <StepCard
      title={org ? "Người đại diện theo pháp luật" : "Danh tính người đăng ký"}
      sub="Tổ chức đấu giá đối chiếu thông tin này khi duyệt hồ sơ và khi bạn điểm danh."
    >
      {usingSaved && saved ? (
        <>
          <div className="flex items-start gap-3.5 rounded-xl bg-primary/[.06] p-4 ring-1 ring-inset ring-primary/20">
            {vneid ? (
              <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            ) : (
              <UserCheck className="h-5 w-5 shrink-0 text-primary" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <b className="text-foreground">{p.full_name}</b>
                <TagPill tag={{ label: vneid ? "Đã xác thực VNeID" : "Danh tính đã lưu", tone: "ok" }} />
              </div>
              <div className="mt-2.5">
                <InfoGrid
                  rows={[
                    { label: ID_TYPE_LABELS[p.id_type], value: <span className="font-mono">{mask(p.id_number)}</span> },
                    { label: "Ngày sinh", value: dob(p.date_of_birth) },
                    { label: "Địa chỉ thường trú", value: p.address || "—", full: true },
                  ]}
                />
              </div>
            </div>
          </div>
          {savedErrors.length > 0 ? (
            <Note tone="amber">
              <p className="font-medium">Danh tính đã lưu chưa đủ để đăng ký:</p>
              <ul className="list-disc pl-5">
                {savedErrors.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </Note>
          ) : (
            <p className="text-xs text-muted-foreground">
              {vneid
                ? "Danh tính đã xác thực qua VNeID nên không cần tải ảnh giấy tờ."
                : "Dùng lại ảnh giấy tờ đã lưu trên tài khoản — không cần chụp lại."}
            </p>
          )}
          {org && (
            <p className="text-xs text-muted-foreground">
              Nếu bạn không phải người đại diện theo pháp luật, chọn "Đăng ký bằng danh tính khác" và chụp giấy tờ của họ.
            </p>
          )}
          <div>
            <button type="button" className="text-[13px] font-medium text-primary disabled:opacity-50" onClick={props.onUseOther} disabled={submitting}>
              Đăng ký bằng danh tính khác
            </button>
          </div>
        </>
      ) : (
        <>
          {!saved && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3">
              <div className="text-sm">
                <p className="font-medium text-foreground">Điền nhanh bằng VNeID</p>
                <p className="text-xs text-muted-foreground">Họ tên, CCCD, ngày sinh, nơi thường trú lấy từ ứng dụng định danh.</p>
              </div>
              <VneidButton size="sm" onClick={() => setVneidOpen(true)} disabled={submitting} />
            </div>
          )}

          <IdentityCapture
            value={p}
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

          {saved && (
            <div>
              <button type="button" className="text-[13px] font-medium text-primary disabled:opacity-50" onClick={() => props.onUseSaved(saved)} disabled={submitting}>
                {vneid ? "Dùng danh tính VNeID đã lưu" : "Dùng danh tính đã lưu"}
              </button>
            </div>
          )}
        </>
      )}

      <VneidConsentDialog open={vneidOpen} onOpenChange={setVneidOpen} onLinked={props.onUseSaved} />
    </StepCard>
  );
}
