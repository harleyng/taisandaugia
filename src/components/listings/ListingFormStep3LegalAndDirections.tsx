import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEGAL_STATUSES, DIRECTIONS } from "@/constants/listing.constants";
import { DirectionCompass } from "./DirectionCompass";
import { NumberInput } from "@/components/ui/number-input";

interface ListingFormStep3LegalAndDirectionsProps {
  propertyTypeSlug: string;
  purpose: string;
  legalStatus: string;
  setLegalStatus: (value: string) => void;
  houseDirection: string;
  setHouseDirection: (value: string) => void;
  facadeWidth: string;
  setFacadeWidth: (value: string) => void;
  alleyWidth: string;
  setAlleyWidth: (value: string) => void;
}

export const ListingFormStep3LegalAndDirections = ({
  propertyTypeSlug,
  purpose,
  legalStatus,
  setLegalStatus,
  houseDirection,
  setHouseDirection,
  facadeWidth,
  setFacadeWidth,
  alleyWidth,
  setAlleyWidth,
}: ListingFormStep3LegalAndDirectionsProps) => {
  // Hiển thị tất cả các field cho tất cả loại BĐS (tạm thời)
  const showLegalStatus = true;
  const showHouseDirection = true;
  const showFacadeWidth = true;
  const showAlleyWidth = true;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold mb-2">Thông tin bổ sung</h2>
        <p className="text-muted-foreground text-lg">
          Cung cấp thêm thông tin về bất động sản của bạn
        </p>
      </div>

      <div className="space-y-4">
        {showLegalStatus && (
          <div className="space-y-2">
            <Label htmlFor="legal-status">Pháp lý</Label>
            <Select value={legalStatus} onValueChange={setLegalStatus}>
              <SelectTrigger id="legal-status">
                <SelectValue placeholder="Chọn tình trạng pháp lý" />
              </SelectTrigger>
              <SelectContent>
                {LEGAL_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {showFacadeWidth && (
            <div className="space-y-2">
              <Label htmlFor="facade-width">Chiều rộng mặt tiền (m)</Label>
              <NumberInput
                id="facade-width"
                placeholder="Nhập chiều rộng mặt tiền"
                value={facadeWidth}
                onChange={setFacadeWidth}
              />
            </div>
          )}

          {showAlleyWidth && (
            <div className="space-y-2">
              <Label htmlFor="alley-width">Độ rộng đường vào (m)</Label>
              <NumberInput
                id="alley-width"
                placeholder="Nhập độ rộng đường vào"
                value={alleyWidth}
                onChange={setAlleyWidth}
              />
            </div>
          )}
        </div>

        {showHouseDirection && (
          <DirectionCompass
            value={houseDirection}
            onChange={setHouseDirection}
            label="Hướng nhà"
          />
        )}
      </div>
    </div>
  );
};
