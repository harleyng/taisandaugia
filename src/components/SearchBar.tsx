import { useState } from "react";
import { Search, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Purpose = "sale" | "rent" | "auction";

interface SearchBarProps {
  variant?: "hero" | "default";
}

const heroAreas = [
  { value: "Hà Nội", label: "Hà Nội" },
  { value: "TP. HCM", label: "TP. HCM" },
  { value: "Đà Nẵng", label: "Đà Nẵng" },
  { value: "Bình Dương", label: "Bình Dương" },
  { value: "Đồng Nai", label: "Đồng Nai" },
  { value: "all", label: "Toàn quốc" },
];

const heroPropertyTypes = [
  { value: "all", label: "Tất cả" },
  { value: "quyen-su-dung-dat", label: "Quyền sử dụng đất" },
  { value: "nha-rieng-le", label: "Nhà riêng lẻ" },
  { value: "can-ho", label: "Căn hộ" },
  { value: "dat-du-an", label: "Đất dự án" },
  { value: "thi-hanh-an", label: "Thi hành án" },
  { value: "tai-san-cong", label: "Tài sản công" },
];

export const SearchBar = ({ variant = "default" }: SearchBarProps) => {
  const navigate = useNavigate();
  const isHero = variant === "hero";

  // Hero variant state
  const [heroArea, setHeroArea] = useState("Hà Nội");
  const [heroType, setHeroType] = useState("all");

  // Default variant state
  const [purpose, setPurpose] = useState<Purpose>("auction");
  const [location, setLocation] = useState("");
  const [priceRange, setPriceRange] = useState("");

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (isHero) {
      params.append("purpose", "auction");
      if (heroArea && heroArea !== "all") params.append("location", heroArea);
      if (heroType && heroType !== "all") params.append("propertyType", heroType);
    } else {
      if (purpose) params.append("purpose", purpose);
      if (location) params.append("location", location);
      if (priceRange) params.append("priceRange", priceRange);
    }
    navigate(`/listings?${params.toString()}`);
  };

  const tabs: { key: Purpose; label: string }[] = [
    { key: "auction", label: "Đấu giá" },
    { key: "sale", label: "Mua" },
    { key: "rent", label: "Thuê" },
  ];

  if (isHero) {
    return (
      <div className="rounded-xl overflow-hidden bg-white/15 backdrop-blur-md border border-white/20 shadow-2xl">
        <div className="p-4 md:p-5">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 md:gap-4 items-end">
            <div>
              <label className="text-xs mb-1.5 block text-white/70">Khu vực</label>
              <Select value={heroArea} onValueChange={setHeroArea}>
                <SelectTrigger className="h-10 text-sm bg-white border-white/20">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Chọn khu vực" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {heroAreas.map((area) => (
                    <SelectItem key={area.value} value={area.value}>
                      {area.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs mb-1.5 block text-white/70">Loại tài sản</label>
              <Select value={heroType} onValueChange={setHeroType}>
                <SelectTrigger className="h-10 text-sm bg-white border-white/20">
                  <SelectValue placeholder="Chọn loại BĐS" />
                </SelectTrigger>
                <SelectContent>
                  {heroPropertyTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="h-10 px-8 bg-foreground hover:bg-foreground/90 text-background font-medium"
              onClick={handleSearch}
            >
              <Search className="h-4 w-4 mr-2" />
              Tìm kiếm
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className="rounded-xl overflow-hidden bg-card shadow-lg border border-border">
      {/* Tabs row */}
      <div className="flex">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPurpose(tab.key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative
              ${
                purpose === tab.key
                  ? "text-foreground bg-card"
                  : "text-muted-foreground bg-secondary/50 hover:text-foreground hover:bg-secondary/80"
              }`}
          >
            <span className="flex items-center justify-center gap-1">
              {tab.label}
              {tab.key === "auction" && (
                <span className="bg-destructive text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  HOT
                </span>
              )}
            </span>
            {purpose === tab.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="p-4 md:p-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 md:gap-4 items-end">
          <div>
            <label className="text-xs mb-1.5 block text-muted-foreground">Vị trí</label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger className="h-10 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Toàn quốc" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toàn quốc</SelectItem>
                {vietnamProvinces.map((province) => (
                  <SelectItem key={province.name} value={province.name}>
                    {province.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs mb-1.5 block text-muted-foreground">Mức giá</label>
            <Select value={priceRange} onValueChange={setPriceRange}>
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="Tất cả mức giá" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0-1">Dưới 1 tỷ</SelectItem>
                <SelectItem value="1-3">1 - 3 tỷ</SelectItem>
                <SelectItem value="3-5">3 - 5 tỷ</SelectItem>
                <SelectItem value="5-10">5 - 10 tỷ</SelectItem>
                <SelectItem value="10-20">10 - 20 tỷ</SelectItem>
                <SelectItem value="20+">Trên 20 tỷ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            className="h-10 px-8 bg-foreground hover:bg-foreground/90 text-background font-medium"
            onClick={handleSearch}
          >
            <Search className="h-4 w-4 mr-2" />
            Tìm kiếm
          </Button>
        </div>
      </div>
    </div>
  );
};
