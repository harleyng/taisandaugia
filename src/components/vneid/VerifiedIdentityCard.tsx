import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { maskIdNumber } from "@/lib/biddingContracts/filters";
import { useUnlinkVneid, useVerifiedIdentity } from "@/hooks/useVneidIdentity";
import { GENDER_LABELS } from "@/types/bidding-contract";
import { VneidButton } from "./VneidButton";
import { VneidConsentDialog } from "./VneidConsentDialog";

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("vi-VN") : "—");

/** Thẻ "Danh tính đã xác thực" trong trang Hồ sơ cá nhân. */
export function VerifiedIdentityCard() {
  const { data: identity, isLoading } = useVerifiedIdentity();
  const unlink = useUnlinkVneid();
  const [linking, setLinking] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);

  if (isLoading) return null;

  return (
    <Card className="space-y-4 rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Danh tính đã xác thực (VNeID)
          </h3>
          <p className="text-sm text-muted-foreground">
            Dùng để điền nhanh hồ sơ tham gia đấu giá. Tổ chức đấu giá thấy hồ sơ được đánh dấu đã xác thực.
          </p>
        </div>
        {identity ? (
          <Button variant="outline" size="sm" onClick={() => setConfirmUnlink(true)} disabled={unlink.isPending}>
            Huỷ liên kết
          </Button>
        ) : (
          <VneidButton size="sm" onClick={() => setLinking(true)}>
            Liên kết VNeID
          </VneidButton>
        )}
      </div>

      {identity && (
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Họ và tên</dt>
            <dd className="font-medium text-foreground">{identity.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Số CCCD</dt>
            <dd className="font-mono text-foreground">{maskIdNumber(identity.id_number)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Ngày sinh · Giới tính</dt>
            <dd className="text-foreground">
              {formatDate(identity.date_of_birth)} · {identity.gender ? GENDER_LABELS[identity.gender] : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Xác thực lúc</dt>
            <dd className="text-foreground">{new Date(identity.verified_at).toLocaleString("vi-VN")}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Nơi thường trú</dt>
            <dd className="text-foreground">{identity.address}</dd>
          </div>
        </dl>
      )}

      <VneidConsentDialog open={linking} onOpenChange={setLinking} />

      <AlertDialog open={confirmUnlink} onOpenChange={setConfirmUnlink}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Huỷ liên kết VNeID?</AlertDialogTitle>
            <AlertDialogDescription>
              Lần mua hồ sơ sau bạn sẽ phải xác thực lại hoặc nhập tay. Các hồ sơ đã mua không bị ảnh hưởng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ liên kết</AlertDialogCancel>
            <AlertDialogAction onClick={() => unlink.mutate()} disabled={unlink.isPending}>
              {unlink.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Huỷ liên kết
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
