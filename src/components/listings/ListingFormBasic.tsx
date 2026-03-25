import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRICE_UNITS } from "@/constants/listing.constants";
import { PriceUnit } from "@/types/listing.types";

interface ListingFormBasicProps {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  price: string;
  setPrice: (value: string) => void;
  priceUnit: PriceUnit;
  setPriceUnit: (value: PriceUnit) => void;
  area: string;
  setArea: (value: string) => void;
  prominentFeatures: string;
  setProminentFeatures: (value: string) => void;
  projectName: string;
  setProjectName: (value: string) => void;
}

export const ListingFormBasic = ({
  title,
  setTitle,
  description,
  setDescription,
  price,
  setPrice,
  priceUnit,
  setPriceUnit,
  area,
  setArea,
  prominentFeatures,
  setProminentFeatures,
  projectName,
  setProjectName,
}: ListingFormBasicProps) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="title">Tiêu đề tin đăng <span className="text-destructive">*</span></Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="VD: Bán căn hộ cao cấp 2PN tại quận 1"
          required
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Mô tả chi tiết <span className="text-destructive">*</span></Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Mô tả chi tiết về bất động sản..."
          rows={6}
          required
          maxLength={5000}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">Giá <span className="text-destructive">*</span></Label>
          <Input
            id="price"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="VD: 5000000000"
            required
            min="0"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="priceUnit">Đơn vị tính giá <span className="text-destructive">*</span></Label>
          <Select value={priceUnit} onValueChange={(v: PriceUnit) => setPriceUnit(v)} required>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRICE_UNITS).map(([key, value]) => (
                <SelectItem key={key} value={key}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="area">Diện tích (m²) <span className="text-destructive">*</span></Label>
          <Input
            id="area"
            type="number"
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="VD: 80"
            required
            min="0"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="prominentFeatures">Đặc điểm nổi bật</Label>
        <Input
          id="prominentFeatures"
          value={prominentFeatures}
          onChange={(e) => setProminentFeatures(e.target.value)}
          placeholder="VD: Gần trường học, View đẹp, An ninh 24/7 (cách nhau bởi dấu phẩy)"
          maxLength={500}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="projectName">Tên dự án (nếu có)</Label>
        <Input
          id="projectName"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="VD: Vinhomes Central Park"
          maxLength={200}
        />
      </div>
    </>
  );
};
