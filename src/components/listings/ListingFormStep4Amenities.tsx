import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { 
  Sofa, 
  AirVent, 
  Fan, 
  Flame, 
  Droplets, 
  WashingMachine, 
  Refrigerator, 
  Microwave, 
  Tv, 
  ChefHat,
  Shield,
  Camera,
  Fingerprint,
  Building2,
  Car,
  Home,
  Dumbbell,
  Waves,
  Trees,
  LucideIcon
} from "lucide-react";

interface ListingFormStep4AmenitiesProps {
  amenities: string[];
  setAmenities: (value: string[]) => void;
}

// Icon map for amenities
const AMENITY_ICONS: Record<string, LucideIcon> = {
  air_conditioning: AirVent,
  ceiling_fan: Fan,
  standing_fan: Fan,
  heater: Flame,
  water_heater: Droplets,
  washing_machine: WashingMachine,
  refrigerator: Refrigerator,
  microwave: Microwave,
  tv: Tv,
  kitchen: ChefHat,
  security_guard: Shield,
  cctv: Camera,
  fingerprint_lock: Fingerprint,
  elevator: Building2,
  parking: Car,
  balcony: Home,
  gym: Dumbbell,
  swimming_pool: Waves,
  garden: Trees,
};

// Define amenity groups
const AMENITY_GROUPS = {
  furniture: {
    title: "Nội thất",
    required: true,
    type: "radio" as const,
    options: [
      { value: "full_furnished", label: "Đầy đủ nội thất", icon: Sofa },
      { value: "basic_furnished", label: "Nội thất cơ bản", icon: Sofa },
      { value: "unfurnished", label: "Không có nội thất", icon: Home },
    ],
  },
  cooling: {
    title: "Làm mát",
    type: "checkbox" as const,
    options: [
      { value: "air_conditioning", label: "Điều hòa" },
      { value: "ceiling_fan", label: "Quạt trần" },
      { value: "standing_fan", label: "Quạt đứng" },
    ],
  },
  heating: {
    title: "Sưởi ấm",
    type: "checkbox" as const,
    options: [
      { value: "heater", label: "Máy sưởi" },
      { value: "water_heater", label: "Bình nóng lạnh" },
    ],
  },
  appliances: {
    title: "Thiết bị điện",
    type: "checkbox" as const,
    options: [
      { value: "washing_machine", label: "Máy giặt" },
      { value: "refrigerator", label: "Tủ lạnh" },
      { value: "microwave", label: "Lò vi sóng" },
      { value: "tv", label: "TV" },
      { value: "kitchen", label: "Bếp nấu" },
    ],
  },
  security: {
    title: "An ninh",
    type: "checkbox" as const,
    options: [
      { value: "security_guard", label: "Bảo vệ 24/7" },
      { value: "cctv", label: "Camera an ninh" },
      { value: "fingerprint_lock", label: "Khóa vân tay" },
    ],
  },
  facilities: {
    title: "Tiện ích khác",
    type: "checkbox" as const,
    options: [
      { value: "elevator", label: "Thang máy" },
      { value: "parking", label: "Chỗ đậu xe" },
      { value: "balcony", label: "Ban công" },
      { value: "gym", label: "Phòng gym" },
      { value: "swimming_pool", label: "Hồ bơi" },
      { value: "garden", label: "Sân vườn" },
    ],
  },
};

export const ListingFormStep4Amenities = ({
  amenities,
  setAmenities,
}: ListingFormStep4AmenitiesProps) => {
  const handleCheckboxToggle = (value: string) => {
    if (amenities.includes(value)) {
      setAmenities(amenities.filter((a) => a !== value));
    } else {
      setAmenities([...amenities, value]);
    }
  };

  const handleRadioSelect = (groupKey: string, value: string) => {
    // Remove all options from this radio group first
    const groupOptions = AMENITY_GROUPS[groupKey as keyof typeof AMENITY_GROUPS].options.map(
      (opt) => opt.value
    );
    const filtered = amenities.filter((a) => !groupOptions.includes(a));
    setAmenities([...filtered, value]);
  };

  const getRadioValue = (groupKey: string) => {
    const groupOptions = AMENITY_GROUPS[groupKey as keyof typeof AMENITY_GROUPS].options.map(
      (opt) => opt.value
    );
    return amenities.find((a) => groupOptions.includes(a)) || "";
  };

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold mb-2">
          Cho khách biết chỗ ở của bạn có những gì
        </h2>
        <p className="text-muted-foreground text-lg">
          Chia sẻ nhiều hơn sẽ giúp người thuê hình dung rõ hơn về nơi ở của bạn.
        </p>
      </div>

      <div className="space-y-8">
        {Object.entries(AMENITY_GROUPS).map(([groupKey, group]) => (
          <div key={groupKey} className="space-y-4 pb-6">
            <Label className="text-lg font-semibold">
              {group.title}
              {'required' in group && group.required && <span className="text-destructive ml-1">*</span>}
            </Label>

            {group.type === "radio" ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {group.options.map((option) => {
                  const isSelected = getRadioValue(groupKey) === option.value;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleRadioSelect(groupKey, option.value)}
                      className={cn(
                        "flex flex-col items-start p-6 rounded-xl border-2 transition-all hover:border-foreground hover:shadow-md",
                        isSelected
                          ? "border-foreground bg-muted shadow-md"
                          : "border-border bg-background"
                      )}
                    >
                      {Icon && <Icon className={cn("h-8 w-8 mb-3 transition-colors", isSelected ? "text-foreground" : "text-muted-foreground")} />}
                      <span className={cn("text-base font-medium transition-colors", isSelected ? "text-foreground" : "text-foreground/80")}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {group.options.map((option) => {
                  const isSelected = amenities.includes(option.value);
                  const Icon = AMENITY_ICONS[option.value];
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleCheckboxToggle(option.value)}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border-2 transition-all hover:border-foreground hover:shadow-md",
                        isSelected
                          ? "border-foreground bg-muted shadow-md"
                          : "border-border bg-background"
                      )}
                    >
                      {Icon && <Icon className={cn("h-6 w-6 flex-shrink-0 transition-colors", isSelected ? "text-foreground" : "text-muted-foreground")} />}
                      <span className={cn("text-base font-medium text-left transition-colors", isSelected ? "text-foreground" : "text-foreground/80")}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
