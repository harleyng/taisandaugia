import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ListingFormAddressProps {
  province: string;
  setProvince: (value: string) => void;
  district: string;
  setDistrict: (value: string) => void;
  ward: string;
  setWard: (value: string) => void;
  street: string;
  setStreet: (value: string) => void;
}

export const ListingFormAddress = ({
  province,
  setProvince,
  district,
  setDistrict,
  ward,
  setWard,
  street,
  setStreet,
}: ListingFormAddressProps) => {
  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <h3 className="font-semibold">Địa chỉ</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="province">Tỉnh/Thành phố</Label>
          <Input
            id="province"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            placeholder="VD: TP. Hồ Chí Minh"
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="district">Quận/Huyện <span className="text-destructive">*</span></Label>
          <Input
            id="district"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="VD: Quận 1"
            required
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ward">Phường/Xã</Label>
          <Input
            id="ward"
            value={ward}
            onChange={(e) => setWard(e.target.value)}
            placeholder="VD: Phường Bến Nghé"
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="street">Số nhà, đường</Label>
          <Input
            id="street"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="VD: 123 Nguyễn Huệ"
            maxLength={200}
          />
        </div>
      </div>
    </div>
  );
};
