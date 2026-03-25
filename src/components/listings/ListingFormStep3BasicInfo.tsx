import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { NumberInput } from "@/components/ui/number-input";

interface ListingFormStep3BasicInfoProps {
  area: string;
  setArea: (value: string) => void;
  numBedrooms: string;
  setNumBedrooms: (value: string) => void;
  numBathrooms: string;
  setNumBathrooms: (value: string) => void;
}

export const ListingFormStep3BasicInfo = ({
  area,
  setArea,
  numBedrooms,
  setNumBedrooms,
  numBathrooms,
  setNumBathrooms,
}: ListingFormStep3BasicInfoProps) => {
  const handleIncrement = (value: string, setter: (value: string) => void) => {
    const num = parseInt(value) || 0;
    setter(String(num + 1));
  };

  const handleDecrement = (value: string, setter: (value: string) => void) => {
    const num = parseInt(value) || 0;
    if (num > 0) {
      setter(String(num - 1));
    }
  };

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold mb-2">Chia sẻ một số thông tin cơ bản về chỗ ở của bạn</h2>
        <p className="text-muted-foreground text-lg">
          Sau này, bạn sẽ bổ sung những thông tin khác, như loại giường chẳng hạn.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between py-6 border-b">
          <div className="flex-1">
            <Label htmlFor="area" className="text-base font-normal">Diện tích (m²)</Label>
          </div>
          <div className="w-32">
            <NumberInput
              id="area"
              value={area}
              onChange={setArea}
              placeholder="100"
              className="text-center"
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-between py-6 border-b">
          <div className="flex-1">
            <Label className="text-base font-normal">Phòng ngủ</Label>
          </div>
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => handleDecrement(numBedrooms, setNumBedrooms)}
              disabled={!numBedrooms || parseInt(numBedrooms) === 0}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center text-base">{numBedrooms || 0}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => handleIncrement(numBedrooms, setNumBedrooms)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between py-6 border-b">
          <div className="flex-1">
            <Label className="text-base font-normal">Phòng tắm</Label>
          </div>
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => handleDecrement(numBathrooms, setNumBathrooms)}
              disabled={!numBathrooms || parseInt(numBathrooms) === 0}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center text-base">{numBathrooms || 0}</span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={() => handleIncrement(numBathrooms, setNumBathrooms)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
