import { useState } from "react";
import { Camera, Loader2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { VneidButton } from "@/components/vneid/VneidButton";
import { VneidConsentDialog } from "@/components/vneid/VneidConsentDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useDeleteKycProfile, useKycProfile } from "@/hooks/useKycProfile";
import { useProfile } from "@/hooks/useProfile";
import { maskIdNumber } from "@/lib/biddingContracts/filters";
import {
  GENDER_LABELS,
  ID_TYPE_LABELS,
  KYC_FIELD_LABELS,
  READ_METHOD_LABELS,
  SAVED_IDENTITY_SOURCE_LABELS,
} from "@/types/bidding-contract";
import { KycCaptureDialog } from "./KycCaptureDialog";
import { KycImageThumb } from "./KycImageThumb";

const formatDate = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("vi-VN") : "—");

/**
 * Thẻ "Danh tính người mua" trong Hồ sơ cá nhân — thay VerifiedIdentityCard.
 * Lưu một lần (ảnh giấy tờ hoặc VNeID) để lần mua hồ sơ sau không phải KYC lại.
 */
export function KycProfileCard() {
  const { userId } = useAuth();
  const { data: profile } = useProfile(userId);
  const { data: identity, isLoading } = useKycProfile();
  const remove = useDeleteKycProfile();
  const [capturing, setCapturing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading) return null;

  const photo = identity?.source === "id_photo";

  return (
    <Card className="space-y-4 rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Danh tính người mua
          </h3>
          <p className="text-sm text-muted-foreground">
            Lưu một lần để mua hồ sơ tham gia đấu giá nhanh hơn, không phải chụp lại giấy tờ. Tổ chức đấu giá chỉ thấy
            thông tin khi bạn nộp hồ sơ cho phiên của họ.
          </p>
        </div>
        {identity && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCapturing(true)}>
              Cập nhật
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)} disabled={remove.isPending}>
              Xoá
            </Button>
          </div>
        )}
      </div>

      {identity ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">{SAVED_IDENTITY_SOURCE_LABELS[identity.source]}</Badge>
            {photo && identity.read_method && <Badge variant="outline">{READ_METHOD_LABELS[identity.read_method]}</Badge>}
            <span className="text-muted-foreground">
              Lưu lúc {new Date(identity.verified_at).toLocaleString("vi-VN")}
            </span>
          </div>

          {photo && identity.id_front_path && (
            <div className="grid max-w-md grid-cols-2 gap-3">
              <KycImageThumb path={identity.id_front_path} alt="Ảnh mặt trước giấy tờ" className="aspect-[1.586]" />
              {identity.id_back_path && (
                <KycImageThumb path={identity.id_back_path} alt="Ảnh mặt sau giấy tờ" className="aspect-[1.586]" />
              )}
            </div>
          )}

          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Họ và tên</dt>
              <dd className="font-medium text-foreground">{identity.full_name}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Số {ID_TYPE_LABELS[identity.id_type]}</dt>
              <dd className="font-mono text-foreground">{maskIdNumber(identity.id_number)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Ngày sinh · Giới tính</dt>
              <dd className="text-foreground">
                {formatDate(identity.date_of_birth)} · {identity.gender ? GENDER_LABELS[identity.gender] : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Ngày cấp</dt>
              <dd className="text-foreground">{formatDate(identity.id_issued_on)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Nơi thường trú</dt>
              <dd className="text-foreground">{identity.address}</dd>
            </div>
          </dl>

          {photo && identity.edited_fields.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Đã sửa sau khi đọc từ ảnh: {identity.edited_fields.map((f) => KYC_FIELD_LABELS[f]).join(", ")}
            </p>
          )}
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => setCapturing(true)}>
            <Camera className="h-4 w-4" />
            Chụp CCCD / hộ chiếu
          </Button>
          <VneidButton size="sm" variant="outline" onClick={() => setLinking(true)}>
            Liên kết VNeID
          </VneidButton>
        </div>
      )}

      <KycCaptureDialog
        open={capturing}
        onOpenChange={setCapturing}
        saved={identity ?? null}
        profileName={profile?.name}
      />
      <VneidConsentDialog open={linking} onOpenChange={setLinking} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá danh tính đã lưu?</AlertDialogTitle>
            <AlertDialogDescription>
              Ảnh giấy tờ trên hồ sơ của bạn sẽ bị xoá. Lần mua hồ sơ sau bạn phải chụp lại hoặc liên kết VNeID. Các hồ sơ
              tham gia đã nộp giữ nguyên thông tin và ảnh của chúng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()} disabled={remove.isPending}>
              {remove.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
