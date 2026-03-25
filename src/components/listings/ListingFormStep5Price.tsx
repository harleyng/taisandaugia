import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PriceUnit } from "@/types/listing.types";
import { NumberInput } from "@/components/ui/number-input";

interface ListingFormStep5PriceProps {
  price: string;
  setPrice: (value: string) => void;
  priceUnit: PriceUnit;
  setPriceUnit: (value: PriceUnit) => void;
}

export const ListingFormStep5Price = ({
  price,
  setPrice,
  priceUnit,
  setPriceUnit,
}: ListingFormStep5PriceProps) => {
  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold mb-2">Giờ thì hãy đặt giá của bạn</h2>
        <p className="text-muted-foreground text-lg">
          Bạn có thể thay đổi giá này bất cứ lúc nào.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between py-6 border-b">
          <div className="flex-1">
            <Label htmlFor="priceUnit" className="text-base font-normal">
              Đơn vị tính giá <span className="text-destructive">*</span>
            </Label>
          </div>
          <div className="w-48">
            <Select value={priceUnit} onValueChange={(v) => setPriceUnit(v as PriceUnit)}>
              <SelectTrigger id="priceUnit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TOTAL">Tổng giá</SelectItem>
                <SelectItem value="PER_SQM">VND/m²</SelectItem>
                <SelectItem value="PER_MONTH">VND/tháng</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between py-6 border-b">
          <div className="flex-1">
            <Label htmlFor="price" className="text-base font-normal">
              Giá <span className="text-destructive">*</span>
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              {priceUnit === "TOTAL" && "Tổng giá bán"}
              {priceUnit === "PER_SQM" && "Giá trên mỗi mét vuông"}
              {priceUnit === "PER_MONTH" && "Giá thuê mỗi tháng"}
            </p>
          </div>
          <div className="w-48">
            <NumberInput
              id="price"
              value={price}
              onChange={setPrice}
              placeholder="0"
              className="text-right text-lg"
              required
            />
          </div>
        </div>
      </div>
    </div>
  );
};
