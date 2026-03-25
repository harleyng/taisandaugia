import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DIRECTIONS, LEGAL_STATUSES, INTERIOR_STATUSES, LAND_TYPES } from "@/constants/listing.constants";

interface ListingFormAttributesProps {
  currentFilters: string[];
  numBedrooms: string;
  setNumBedrooms: (value: string) => void;
  numBathrooms: string;
  setNumBathrooms: (value: string) => void;
  numFloors: string;
  setNumFloors: (value: string) => void;
  floorNumber: string;
  setFloorNumber: (value: string) => void;
  houseDirection: string;
  setHouseDirection: (value: string) => void;
  balconyDirection: string;
  setBalconyDirection: (value: string) => void;
  landDirection: string;
  setLandDirection: (value: string) => void;
  facadeWidth: string;
  setFacadeWidth: (value: string) => void;
  alleyWidth: string;
  setAlleyWidth: (value: string) => void;
  legalStatus: string;
  setLegalStatus: (value: string) => void;
  interiorStatus: string;
  setInteriorStatus: (value: string) => void;
  landType: string;
  setLandType: (value: string) => void;
}

export const ListingFormAttributes = ({
  currentFilters,
  numBedrooms,
  setNumBedrooms,
  numBathrooms,
  setNumBathrooms,
  numFloors,
  setNumFloors,
  floorNumber,
  setFloorNumber,
  houseDirection,
  setHouseDirection,
  balconyDirection,
  setBalconyDirection,
  landDirection,
  setLandDirection,
  facadeWidth,
  setFacadeWidth,
  alleyWidth,
  setAlleyWidth,
  legalStatus,
  setLegalStatus,
  interiorStatus,
  setInteriorStatus,
  landType,
  setLandType,
}: ListingFormAttributesProps) => {
  if (currentFilters.length === 0) return null;

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
      <h3 className="font-semibold">Thông tin chi tiết</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {currentFilters.includes("numBedrooms") && (
          <div className="space-y-2">
            <Label htmlFor="numBedrooms">Số phòng ngủ</Label>
            <Input
              id="numBedrooms"
              type="number"
              value={numBedrooms}
              onChange={(e) => setNumBedrooms(e.target.value)}
              min="0"
            />
          </div>
        )}

        {currentFilters.includes("numBathrooms") && (
          <div className="space-y-2">
            <Label htmlFor="numBathrooms">Số phòng vệ sinh</Label>
            <Input
              id="numBathrooms"
              type="number"
              value={numBathrooms}
              onChange={(e) => setNumBathrooms(e.target.value)}
              min="0"
            />
          </div>
        )}

        {currentFilters.includes("numFloors") && (
          <div className="space-y-2">
            <Label htmlFor="numFloors">Số tầng</Label>
            <Input
              id="numFloors"
              type="number"
              value={numFloors}
              onChange={(e) => setNumFloors(e.target.value)}
              min="0"
            />
          </div>
        )}

        {currentFilters.includes("floorNumber") && (
          <div className="space-y-2">
            <Label htmlFor="floorNumber">Tầng số</Label>
            <Input
              id="floorNumber"
              type="number"
              value={floorNumber}
              onChange={(e) => setFloorNumber(e.target.value)}
              min="0"
            />
          </div>
        )}

        {currentFilters.includes("houseDirection") && (
          <div className="space-y-2">
            <Label htmlFor="houseDirection">Hướng nhà</Label>
            <Select value={houseDirection} onValueChange={setHouseDirection}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn hướng" />
              </SelectTrigger>
              <SelectContent>
                {DIRECTIONS.map((dir) => (
                  <SelectItem key={dir} value={dir}>{dir}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {currentFilters.includes("balconyDirection") && (
          <div className="space-y-2">
            <Label htmlFor="balconyDirection">Hướng ban công</Label>
            <Select value={balconyDirection} onValueChange={setBalconyDirection}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn hướng" />
              </SelectTrigger>
              <SelectContent>
                {DIRECTIONS.map((dir) => (
                  <SelectItem key={dir} value={dir}>{dir}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {currentFilters.includes("landDirection") && (
          <div className="space-y-2">
            <Label htmlFor="landDirection">Hướng đất</Label>
            <Select value={landDirection} onValueChange={setLandDirection}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn hướng" />
              </SelectTrigger>
              <SelectContent>
                {DIRECTIONS.map((dir) => (
                  <SelectItem key={dir} value={dir}>{dir}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {currentFilters.includes("facadeWidth") && (
          <div className="space-y-2">
            <Label htmlFor="facadeWidth">Chiều rộng mặt tiền (m)</Label>
            <Input
              id="facadeWidth"
              type="number"
              value={facadeWidth}
              onChange={(e) => setFacadeWidth(e.target.value)}
              min="0"
              step="0.1"
            />
          </div>
        )}

        {currentFilters.includes("alleyWidth") && (
          <div className="space-y-2">
            <Label htmlFor="alleyWidth">Chiều rộng đường vào (m)</Label>
            <Input
              id="alleyWidth"
              type="number"
              value={alleyWidth}
              onChange={(e) => setAlleyWidth(e.target.value)}
              min="0"
              step="0.1"
            />
          </div>
        )}

        {currentFilters.includes("legalStatus") && (
          <div className="space-y-2">
            <Label htmlFor="legalStatus">Pháp lý</Label>
            <Select value={legalStatus} onValueChange={setLegalStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn pháp lý" />
              </SelectTrigger>
              <SelectContent>
                {LEGAL_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {currentFilters.includes("interiorStatus") && (
          <div className="space-y-2">
            <Label htmlFor="interiorStatus">Tình trạng nội thất</Label>
            <Select value={interiorStatus} onValueChange={setInteriorStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn tình trạng" />
              </SelectTrigger>
              <SelectContent>
                {INTERIOR_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {currentFilters.includes("landType") && (
          <div className="space-y-2">
            <Label htmlFor="landType">Loại đất</Label>
            <Select value={landType} onValueChange={setLandType}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn loại đất" />
              </SelectTrigger>
              <SelectContent>
                {LAND_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
};
