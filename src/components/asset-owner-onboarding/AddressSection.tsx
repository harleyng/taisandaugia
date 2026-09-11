import { MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AddressValue {
  address: string;
  ward: string;
  province: string;
}

interface Props {
  title: string;
  addressLabel: string;
  value: AddressValue;
  /** Tổ chức chỉ khai địa chỉ trụ sở + tỉnh; cá nhân khai thêm phường / xã. */
  showWard?: boolean;
  onChange: (fields: Partial<AddressValue>) => void;
}

/**
 * Địa chỉ trên hồ sơ xác thực chủ tài sản — Bên A của hợp đồng dịch vụ đấu giá.
 * Lưu vĩnh viễn trên KYC; sửa được cả sau khi duyệt (owner_update_kyc_address).
 */
export const AddressSection = ({ title, addressLabel, value, showWard = true, onChange }: Props) => (
  <Card className="rounded-2xl p-5 space-y-4">
    <div className="space-y-1">
      <h3 className="font-semibold text-foreground flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        {title}
      </h3>
      <p className="text-[11px] text-muted-foreground">
        Ghi vào hợp đồng dịch vụ đấu giá tài sản khi bạn chọn tổ chức đấu giá. Sửa được sau khi hồ sơ được duyệt.
      </p>
    </div>

    <div className="space-y-1.5">
      <Label htmlFor="kyc_address">
        {addressLabel} <span className="text-destructive">*</span>
      </Label>
      <Input
        id="kyc_address"
        value={value.address}
        onChange={(e) => onChange({ address: e.target.value })}
        placeholder="Số 12 Lê Lợi"
      />
    </div>

    <div className="grid grid-cols-2 gap-3">
      {showWard && (
        <div className="space-y-1.5">
          <Label htmlFor="kyc_ward">Phường / xã</Label>
          <Input id="kyc_ward" value={value.ward} onChange={(e) => onChange({ ward: e.target.value })} />
        </div>
      )}
      <div className={`space-y-1.5 ${showWard ? "" : "col-span-2"}`}>
        <Label htmlFor="kyc_province">Tỉnh / thành phố</Label>
        <Input
          id="kyc_province"
          value={value.province}
          onChange={(e) => onChange({ province: e.target.value })}
        />
      </div>
    </div>
  </Card>
);
