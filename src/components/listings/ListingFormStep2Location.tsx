import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationMap } from "./LocationMap";
import { AddressSearchInput } from "./AddressSearchInput";
import { useState } from "react";
interface ListingFormStep2LocationProps {
  province: string;
  setProvince: (value: string) => void;
  district: string;
  setDistrict: (value: string) => void;
  ward: string;
  setWard: (value: string) => void;
  street: string;
  setStreet: (value: string) => void;
  apartmentFloorInfo: string;
  setApartmentFloorInfo: (value: string) => void;
  buildingName: string;
  setBuildingName: (value: string) => void;
  latitude: string;
  setLatitude: (value: string) => void;
  longitude: string;
  setLongitude: (value: string) => void;
  propertyTypeSlug: string;
  purpose: string;
  numFloors?: string;
  setNumFloors?: (value: string) => void;
  floorNumber?: string;
  setFloorNumber?: (value: string) => void;
}
export const ListingFormStep2Location = ({
  province,
  setProvince,
  district,
  setDistrict,
  ward,
  setWard,
  street,
  setStreet,
  apartmentFloorInfo,
  setApartmentFloorInfo,
  buildingName,
  setBuildingName,
  latitude,
  setLatitude,
  longitude,
  setLongitude,
  propertyTypeSlug,
  purpose,
  numFloors,
  setNumFloors,
  floorNumber,
  setFloorNumber
}: ListingFormStep2LocationProps) => {
  const [showForm, setShowForm] = useState(false);
  const [showMapOverlay, setShowMapOverlay] = useState(true);

  // Determine which field to show based on property type
  const showNumFloors = ["nha-pho", "biet-thu", "nha-mat-pho", "nha-rieng"].includes(propertyTypeSlug);
  const showFloorNumber = ["can-ho", "chung-cu", "officetel", "penthouse"].includes(propertyTypeSlug);
  const handleAddressSelect = (address: {
    street: string;
    ward: string;
    district: string;
    province: string;
    latitude?: number;
    longitude?: number;
  }) => {
    setStreet(address.street);
    setWard(address.ward);
    setDistrict(address.district);
    setProvince(address.province);
    if (address.latitude && address.longitude) {
      setLatitude(address.latitude.toString());
      setLongitude(address.longitude.toString());
    }

    // Hide overlay first, then show form after a small delay to ensure clean transition
    setShowMapOverlay(false);
    setTimeout(() => {
      setShowForm(true);
    }, 100);
  };
  const showMap = latitude && longitude && parseFloat(latitude) !== 0 && parseFloat(longitude) !== 0;
  return <div className="space-y-8">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold mb-2">Chỗ ở của bạn nằm ở đâu?</h2>
        <p className="text-muted-foreground text-lg">
          Cung cấp địa chỉ chính xác của bạn để tiếp cận khách hàng dễ dàng hơn
        </p>
      </div>

      {/* Map with search overlay - only show when overlay is active */}
      {showMapOverlay && !showForm && <div className="relative w-full h-[500px] rounded-lg overflow-hidden border bg-muted">
          <div className="w-full h-full flex items-center justify-center bg-muted/50">
            <p className="text-muted-foreground">Tìm kiếm địa chỉ để xem trên bản đồ</p>
          </div>
          
          {/* Search overlay */}
          <div className="absolute top-6 left-6 right-6 z-10">
            <AddressSearchInput onAddressSelect={handleAddressSelect} placeholder="Nhập địa chỉ của bạn" />
          </div>
        </div>}

      {/* Form fields - shown after address selection */}
      {showForm && <div className="space-y-6 animate-in fade-in-0 slide-in-from-top-4">
          <h3 className="text-xl font-semibold">Địa chỉ chi tiết</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="apartmentFloorInfo">
                Căn hộ, tầng, v.v. (Nếu có)
              </Label>
              <Input id="apartmentFloorInfo" value={apartmentFloorInfo} onChange={e => setApartmentFloorInfo(e.target.value)} placeholder="VD: Căn 1205, Tầng 12" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="buildingName">
                Tên toà nhà, v.v. (Nếu có)
              </Label>
              <Input id="buildingName" value={buildingName} onChange={e => setBuildingName(e.target.value)} placeholder="VD: Toà S1.01, Vinhomes Grand Park" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="street">
              Địa chỉ đường/phố <span className="text-destructive">*</span>
            </Label>
            <Input id="street" value={street} onChange={e => setStreet(e.target.value)} placeholder="Số nhà, tên đường" required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ward">
                Phường/Xã <span className="text-destructive">*</span>
              </Label>
              <Input id="ward" value={ward} onChange={e => setWard(e.target.value)} placeholder="VD: Phường Bến Nghé" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="district">
                Quận/Huyện <span className="text-destructive">*</span>
              </Label>
              <Input id="district" value={district} onChange={e => setDistrict(e.target.value)} placeholder="VD: Quận 1" required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="province">
              Tỉnh/Thành phố <span className="text-destructive">*</span>
            </Label>
            <Input id="province" value={province} onChange={e => setProvince(e.target.value)} placeholder="VD: TP. Hồ Chí Minh" required />
          </div>

          {(showNumFloors || showFloorNumber) && <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              {showNumFloors && setNumFloors && <div className="space-y-2">
                  <Label htmlFor="numFloors">Số tầng</Label>
                  <Input id="numFloors" type="number" min="1" value={numFloors} onChange={e => setNumFloors(e.target.value)} placeholder="Ví dụ: 3" />
                </div>}

              {showFloorNumber && setFloorNumber && <div className="space-y-2">
                  <Label htmlFor="floorNumber">Tầng</Label>
                  <Input id="floorNumber" type="number" min="1" value={floorNumber} onChange={e => setFloorNumber(e.target.value)} placeholder="Ví dụ: 15" />
                </div>}
            </div>}

          {showMap && !showMapOverlay && <div className="relative border-t pt-6 pb-16 mt-6 isolate">
              <h3 className="text-lg font-semibold mb-4">Vị trí trên bản đồ</h3>
              <div className="relative z-0">
                <LocationMap key={`form-map-${latitude}-${longitude}`} latitude={parseFloat(latitude)} longitude={parseFloat(longitude)} />
              </div>
            </div>}
        </div>}
    </div>;
};