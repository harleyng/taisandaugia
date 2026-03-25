import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import { Search, X, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

export interface AuctionFilters {
  province: string;
  category: string;
  priceRange: string;
  sessionStatus: string;
  searchQuery: string;
}

interface AuctionFilterSidebarProps {
  filters: AuctionFilters;
  onFiltersChange: (filters: AuctionFilters) => void;
  onReset: () => void;
}

export const defaultAuctionFilters: AuctionFilters = {
  province: "",
  category: "",
  priceRange: "",
  sessionStatus: "",
  searchQuery: "",
};

const PRICE_RANGES = [
  { value: "all", label: "Tất cả mức giá" },
  { value: "0-1000000000", label: "Dưới 1 tỷ" },
  { value: "1000000000-5000000000", label: "1 – 5 tỷ" },
  { value: "5000000000-10000000000", label: "5 – 10 tỷ" },
  { value: "10000000000-", label: "Trên 10 tỷ" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "registration_open", label: "Mở đăng ký" },
  { value: "upcoming", label: "Sắp diễn ra" },
  { value: "ongoing", label: "Đang diễn ra" },
  { value: "ended", label: "Đã kết thúc" },
];

const POPULAR_PROVINCES = [
  "Hà Nội", "TP Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Bình Dương", "Đồng Nai",
];

export function AuctionFilterSidebar({ filters, onFiltersChange, onReset }: AuctionFilterSidebarProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showAllProvinces, setShowAllProvinces] = useState(false);

  const update = (key: keyof AuctionFilters, value: string) => {
    onFiltersChange({ ...filters, [key]: value === "all" ? "" : value });
  };

  const hasFilters = Object.values(filters).some((v) => v !== "");
  const displayedProvinces = showAllProvinces ? vietnamProvinces : vietnamProvinces.filter(p => POPULAR_PROVINCES.includes(p.name));

  return (
    <aside className="space-y-5 relative pb-12">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm mã phiên, địa chỉ..."
          value={filters.searchQuery}
          onChange={(e) => update("searchQuery", e.target.value)}
          className="pl-9 text-sm"
        />
      </div>

      {/* Category */}
      <div>
        <h3 className="font-semibold text-sm text-foreground mb-2">Loại tài sản</h3>
        <div className="space-y-0.5">
          <button
            onClick={() => update("category", "all")}
            className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${
!filters.category ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Tất cả
          </button>
          {ASSET_CATEGORIES.map((cat) => {
            const isExpanded = expandedCategory === cat.slug;
            const isActive = filters.category === cat.slug || cat.children.some(c => c.slug === filters.category);
            return (
              <div key={cat.slug}>
                <button
                  onClick={() => {
                    update("category", cat.slug);
                    setExpandedCategory(isExpanded ? null : cat.slug);
                  }}
                  className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors flex items-center justify-between ${
                    isActive ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <cat.icon className="h-3.5 w-3.5" />
                    {cat.name}
                  </span>
                  {cat.children.length > 0 && (
                    isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
                {isExpanded && cat.children.length > 0 && (
                  <div className="ml-4 mt-0.5 space-y-0.5">
                    {cat.children.map((child) => (
                      <button
                        key={child.slug}
                        onClick={() => update("category", child.slug)}
                        className={`w-full text-left text-sm px-2 py-1 rounded-md transition-colors ${
                          filters.category === child.slug ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {child.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status */}
      <div>
        <h3 className="font-semibold text-sm text-foreground mb-2">Trạng thái</h3>
        <RadioGroup
          value={filters.sessionStatus || "all"}
          onValueChange={(v) => update("sessionStatus", v)}
          className="space-y-1"
        >
          {STATUS_OPTIONS.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <RadioGroupItem value={opt.value} id={`status-${opt.value}`} className="h-3.5 w-3.5" />
              <Label htmlFor={`status-${opt.value}`} className="text-sm text-muted-foreground cursor-pointer">
                {opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="font-semibold text-sm text-foreground mb-2">Giá khởi điểm</h3>
        <RadioGroup
          value={filters.priceRange || "all"}
          onValueChange={(v) => update("priceRange", v)}
          className="space-y-1"
        >
          {PRICE_RANGES.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2">
              <RadioGroupItem value={opt.value} id={`price-${opt.value}`} className="h-3.5 w-3.5" />
              <Label htmlFor={`price-${opt.value}`} className="text-sm text-muted-foreground cursor-pointer">
                {opt.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Province */}
      <div>
        <h3 className="font-semibold text-sm text-foreground mb-2">Tỉnh/Thành phố</h3>
        <div className="space-y-0.5">
          <button
            onClick={() => update("province", "all")}
            className={`w-full text-left text-sm px-2 py-1 rounded-md transition-colors ${
              !filters.province ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Tất cả vị trí
          </button>
          {displayedProvinces.map((p) => (
            <button
              key={p.name}
              onClick={() => update("province", p.name)}
              className={`w-full text-left text-sm px-2 py-1 rounded-md transition-colors ${
                filters.province === p.name ? "bg-foreground text-background font-medium" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {p.name}
            </button>
          ))}
          <button
            onClick={() => setShowAllProvinces(!showAllProvinces)}
            className="text-xs text-primary hover:underline px-2 py-1"
          >
            {showAllProvinces ? "Thu gọn" : "Xem thêm"}
          </button>
        </div>
      </div>

      {/* Reset */}
      <div className="sticky bottom-0 pt-2 pb-1 bg-background">
        <Button variant="outline" size="sm" onClick={onReset} className="w-full gap-1" disabled={!hasFilters}>
          <X className="h-4 w-4" />
          Xóa bộ lọc
        </Button>
      </div>
    </aside>
  );
}
