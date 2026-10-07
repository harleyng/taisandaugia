import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoBox } from "@/components/shared/InfoBox";
import { useSaveIdPhotoIdentity } from "@/hooks/useKycProfile";
import {
  kycProfileDefaults,
  makeKycProfileSchema,
  toSaveIdPhotoInput,
  type IdentityCaptureValues,
  type KycProfileValues,
} from "@/lib/ekyc/kycProfileForm";
import { discardKycFiles } from "@/lib/ekyc/uploadKycImage";
import type { VerifiedIdentity } from "@/types/bidding-contract";
import { IdentityCapture, type IdentityCaptureErrors } from "./IdentityCapture";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Danh tính đang lưu — mở ra để cập nhật. */
  saved: VerifiedIdentity | null;
  profileName?: string | null;
}

function issuesOf(values: KycProfileValues): IdentityCaptureErrors | null {
  const r = makeKycProfileSchema().safeParse(values);
  if (r.success) return null;
  const out: Record<string, string> = {};
  for (const i of r.error.issues) {
    const key = String(i.path[0]);
    out[key] ??= i.message;
  }
  return out as IdentityCaptureErrors;
}

/** Chụp giấy tờ ⇒ lưu danh tính vào hồ sơ người dùng (ghi đè bản cũ, kể cả VNeID). */
export function KycCaptureDialog({ open, onOpenChange, saved, profileName }: Props) {
  const save = useSaveIdPhotoIdentity();
  const [values, setValues] = useState<KycProfileValues>(() => kycProfileDefaults(saved, profileName));
  const [errors, setErrors] = useState<IdentityCaptureErrors | null>(null);
  const [captureBusy, setCaptureBusy] = useState(false);
  // Tệp tải lên trong lượt mở này — huỷ thì dọn, lưu thì dọn phần không dùng.
  const uploads = useRef<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setValues(kycProfileDefaults(saved, profileName));
    setErrors(null);
    uploads.current = [];
    save.reset();
    // Chỉ nạp lại khi mở dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const busy = captureBusy || save.isPending;

  const onChange = (next: IdentityCaptureValues) => {
    const v = { ...next, id_issued_on: next.id_issued_on ?? "" };
    setValues(v);
    // Đã bấm lưu một lần ⇒ kiểm lại ngay để lỗi biến mất khi sửa xong.
    if (errors) setErrors(issuesOf(v) ?? {});
  };

  const close = (next: boolean) => {
    if (next || busy) return;
    void discardKycFiles(uploads.current);
    uploads.current = [];
    onOpenChange(false);
  };

  const submit = () => {
    const problems = issuesOf(values);
    if (problems) {
      setErrors(problems);
      return;
    }
    const input = toSaveIdPhotoInput(values);
    save.mutate(input, {
      onSuccess: () => {
        const kept = new Set([input.id_front_path, input.id_back_path]);
        void discardKycFiles(uploads.current.filter((p) => !kept.has(p)));
        uploads.current = [];
        onOpenChange(false);
      },
    });
  };

  const onUploaded = useCallback((path: string) => uploads.current.push(path), []);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{saved ? "Cập nhật danh tính" : "Lưu danh tính bằng ảnh giấy tờ"}</DialogTitle>
          <DialogDescription>
            Chụp 2 mặt CCCD (hoặc trang thông tin hộ chiếu). Thông tin được đọc từ mã QR trên thẻ để điền sẵn, bạn vẫn
            sửa được.
          </DialogDescription>
        </DialogHeader>

        {saved?.source === "vneid" && (
          <InfoBox variant="amber" className="text-sm">
            Lưu ảnh giấy tờ sẽ thay thế danh tính VNeID đã liên kết.
          </InfoBox>
        )}

        <IdentityCapture
          value={values}
          onChange={onChange}
          errors={errors ?? undefined}
          disabled={save.isPending}
          withIssuedOn
          dobRequired
          onUploaded={onUploaded}
          onBusyChange={setCaptureBusy}
        />

        <p className="text-xs text-muted-foreground">
          Ảnh được lưu riêng tư. Tổ chức đấu giá chỉ xem được khi bạn nộp hồ sơ tham gia phiên của họ.
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={busy}>
            Huỷ
          </Button>
          <Button type="button" onClick={submit} disabled={busy} className="gap-1.5">
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu danh tính
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
