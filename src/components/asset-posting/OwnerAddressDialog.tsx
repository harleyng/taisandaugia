import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateOwnerAddress, type OwnerKycAddress } from "@/hooks/useConsignmentContract";

interface OwnerAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Địa chỉ trên KYC đã duyệt; null khi chưa có KYC đã duyệt. */
  current: OwnerKycAddress | null;
}

/**
 * Bổ sung / sửa địa chỉ trên hồ sơ xác thực chủ tài sản — Bên A của mọi hợp
 * đồng dịch vụ sau này. Lưu vĩnh viễn, không theo từng hợp đồng.
 */
export function OwnerAddressDialog({ open, onOpenChange, current }: OwnerAddressDialogProps) {
  const update = useUpdateOwnerAddress();
  const isOrg = current?.kind === "organization";
  const [address, setAddress] = useState("");
  const [ward, setWard] = useState("");
  const [province, setProvince] = useState("");

  useEffect(() => {
    if (!open) return;
    setAddress(current?.address ?? "");
    setWard(current?.ward ?? "");
    setProvince(current?.province ?? "");
  }, [open, current]);

  const valid = address.trim().length >= 5;

  const submit = () => {
    if (!current || !valid) return;
    update.mutate(
      { kind: current.kind, address, ward: isOrg ? undefined : ward, province },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !update.isPending && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isOrg ? "Địa chỉ trụ sở" : "Địa chỉ của bạn"}</DialogTitle>
          <DialogDescription>
            Ghi vào hợp đồng dịch vụ đấu giá với tư cách Bên A. Địa chỉ lưu trên hồ sơ xác thực và dùng lại cho các
            hợp đồng sau.
          </DialogDescription>
        </DialogHeader>

        {current ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="owner-address">
                {isOrg ? "Địa chỉ trụ sở" : "Số nhà, đường"} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="owner-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={isOrg ? "Số 108 Trần Hưng Đạo, Phường Cửa Nam, Hà Nội" : "Số 12 Lê Lợi"}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {!isOrg && (
                <div className="space-y-1.5">
                  <Label htmlFor="owner-ward">Phường / xã</Label>
                  <Input id="owner-ward" value={ward} onChange={(e) => setWard(e.target.value)} />
                </div>
              )}
              <div className={`space-y-1.5 ${isOrg ? "col-span-2" : ""}`}>
                <Label htmlFor="owner-province">Tỉnh / thành phố</Label>
                <Input id="owner-province" value={province} onChange={(e) => setProvince(e.target.value)} />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Chưa tìm thấy hồ sơ xác thực chủ tài sản đã được duyệt của tài khoản này.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={update.isPending}>
            Để sau
          </Button>
          <Button onClick={submit} disabled={!current || !valid || update.isPending} className="gap-2">
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Lưu địa chỉ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
