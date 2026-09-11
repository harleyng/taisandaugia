import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, QrCode, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoBox } from "@/components/shared/InfoBox";
import { useVneidLink } from "@/hooks/useVneidIdentity";
import { GENDER_LABELS, type VerifiedIdentity } from "@/types/bidding-contract";

const SHARED_FIELDS = ["Họ và tên", "Số định danh cá nhân (CCCD)", "Ngày sinh", "Giới tính", "Nơi thường trú"];

const formatDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("vi-VN") : "—");

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Gọi khi người dùng bấm dùng thông tin vừa nhận. */
  onLinked?: (identity: VerifiedIdentity) => void;
}

/**
 * Luồng xác thực VNeID (MÔ PHỎNG). Như bản thật, sự đồng ý nằm TRONG ứng dụng
 * VNeID: người dùng quét QR và bấm "Đồng ý chia sẻ" trên điện thoại, nên dialog
 * này chỉ nói trước những trường sẽ được chia sẻ rồi chờ kết quả.
 */
export function VneidConsentDialog({ open, onOpenChange, onLinked }: Props) {
  const link = useVneidLink();
  const [identity, setIdentity] = useState<VerifiedIdentity | null>(null);

  // Mở lại dialog là một lượt mới.
  useEffect(() => {
    if (open) {
      setIdentity(null);
      link.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const approve = () => link.mutate(undefined, { onSuccess: setIdentity });

  const useIdentity = () => {
    if (identity) onLinked?.(identity);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !link.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Xác thực bằng <span className="font-extrabold tracking-tight text-primary">VNeID</span>
          </DialogTitle>
          <DialogDescription>
            Lấy thông tin định danh từ ứng dụng VNeID để điền nhanh và chính xác hồ sơ tham gia đấu giá.
          </DialogDescription>
        </DialogHeader>

        <InfoBox variant="amber" className="text-xs">
          Môi trường mô phỏng — không kết nối hệ thống định danh của Bộ Công an. Thông tin nhận về là dữ liệu mẫu.
        </InfoBox>

        {identity ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <CheckCircle2 className="h-5 w-5" />
              Đã nhận thông tin từ VNeID
            </div>
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 rounded-xl bg-muted p-4 text-sm">
              <dt className="text-muted-foreground">Họ và tên</dt>
              <dd className="font-medium text-foreground">{identity.full_name}</dd>
              <dt className="text-muted-foreground">Số CCCD</dt>
              <dd className="font-mono text-foreground">{identity.id_number}</dd>
              <dt className="text-muted-foreground">Ngày sinh</dt>
              <dd className="text-foreground">{formatDate(identity.date_of_birth)}</dd>
              <dt className="text-muted-foreground">Giới tính</dt>
              <dd className="text-foreground">{identity.gender ? GENDER_LABELS[identity.gender] : "—"}</dd>
              <dt className="text-muted-foreground">Nơi thường trú</dt>
              <dd className="text-foreground">{identity.address}</dd>
            </dl>
            <p className="text-xs text-muted-foreground">
              Thông tin đã được lưu vào hồ sơ cá nhân để dùng cho lần mua sau. Bạn có thể huỷ liên kết trong trang Hồ sơ cá
              nhân.
            </p>
          </div>
        ) : link.isPending ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Đang chờ xác nhận trên ứng dụng VNeID…</p>
            <p className="text-xs text-muted-foreground">Không đóng cửa sổ này.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[9rem_1fr] sm:items-center">
            <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-xl border-2 border-primary/40 bg-card">
              <QrCode className="h-24 w-24 text-foreground" strokeWidth={1.25} />
            </div>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-foreground">
                <Smartphone className="h-4 w-4" />
                Mở ứng dụng VNeID → Quét mã QR
              </p>
              <p className="text-muted-foreground">Ứng dụng sẽ hỏi bạn đồng ý chia sẻ:</p>
              <ul className="list-inside list-disc space-y-0.5 text-muted-foreground">
                {SHARED_FIELDS.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter>
          {identity ? (
            <Button onClick={useIdentity}>{onLinked ? "Điền vào hồ sơ" : "Xong"}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={link.isPending}>
                Huỷ
              </Button>
              <Button onClick={approve} disabled={link.isPending} className="gap-1.5">
                {link.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Mô phỏng đồng ý trên VNeID
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
