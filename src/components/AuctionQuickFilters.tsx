import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Search, SlidersHorizontal, ChevronDown, X } from "lucide-react";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import {
  type AuctionFilters,
  STATUS_OPTIONS,
  PRICE_RANGES,
  countActiveFilters,
} from "@/types/auction-filters.types";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AuctionQuickFiltersProps {
  filters: AuctionFilters;
  onFiltersChange: (filters: AuctionFilters) => void;
  onOpenAdvanced: () => void;
}

export function AuctionQuickFilters({ filters, onFiltersChange, onOpenAdvanced }: AuctionQuickFiltersProps) {
  const activeCount = countActiveFilters(filters);
  const update = (key: keyof AuctionFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const categoryLabel = filters.category
    ? ASSET_CATEGORIES.find(c => c.slug === filters.category)?.name
      || ASSET_CATEGORIES.flatMap(c => c.children).find(c => c.slug === filters.category)?.name
      || "Loại tài sản"
    : "Loại tài sản";

  const provinceLabel = filters.province || "Địa điểm đấu giá";
  const statusLabel = filters.sessionStatus
    ? STATUS_OPTIONS.find(s => s.value === filters.sessionStatus)?.label || "Trạng thái"
    : "Trạng thái";

  const priceLabel = (filters.priceMin || filters.priceMax)
    ? `${filters.priceMin ? formatShortPrice(filters.priceMin) : "0"} – ${filters.priceMax ? formatShortPrice(filters.priceMax) : "∞"}`
    : "Giá khởi điểm";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-[300px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm mã phiên, địa chỉ..."
          value={filters.searchQuery}
          onChange={(e) => update("searchQuery", e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Advanced filter button */}
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-1.5"
        onClick={onOpenAdvanced}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Lọc
        {activeCount > 0 && (
          <Badge variant="default" className="h-5 w-5 p-0 flex items-center justify-center text-xs rounded-full">
            {activeCount}
          </Badge>
        )}
      </Button>

      {/* Category chip */}
      <FilterChip
        label={categoryLabel}
        isActive={!!filters.category}
        onClear={() => update("category", "")}
      >
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-0.5 p-1">
            {ASSET_CATEGORIES.map((cat) => (
              <div key={cat.slug}>
                <button
                  onClick={() => update("category", cat.slug)}
                  className={`w-full text-left text-sm px-3 py-1.5 rounded-md transition-colors ${
                    filters.category === cat.slug ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"
                  }`}
                >
                  {cat.name}
                </button>
                {cat.children.map((child) => (
                  <button
                    key={child.slug}
                    onClick={() => update("category", child.slug)}
                    className={`w-full text-left text-sm px-6 py-1 rounded-md transition-colors ${
                      filters.category === child.slug ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </FilterChip>

      {/* Province chip */}
      <FilterChip
        label={provinceLabel}
        isActive={!!filters.province}
        onClear={() => onFiltersChange({ ...filters, province: "", district: "" })}
      >
        <ScrollArea className="max-h-[300px]">
          <div className="space-y-0.5 p-1">
            {vietnamProvinces.map((p) => (
              <button
                key={p.name}
                onClick={() => onFiltersChange({ ...filters, province: p.name, district: "" })}
                className={`w-full text-left text-sm px-3 py-1.5 rounded-md transition-colors ${
                  filters.province === p.name ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </ScrollArea>
      </FilterChip>

      {/* Status chip */}
      <FilterChip
        label={statusLabel}
        isActive={!!filters.sessionStatus}
        onClear={() => update("sessionStatus", "")}
      >
        <div className="space-y-0.5 p-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update("sessionStatus", opt.value)}
              className={`w-full text-left text-sm px-3 py-1.5 rounded-md transition-colors ${
                filters.sessionStatus === opt.value ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FilterChip>
    </div>
  );
}

function FilterChip({
  label,
  isActive,
  onClear,
  children,
}: {
  label: string;
  isActive: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isActive ? "default" : "outline"}
          size="sm"
          className="h-9 gap-1 text-sm"
        >
          <span className="max-w-[120px] truncate">{label}</span>
          {isActive ? (
            <X
              className="h-3.5 w-3.5 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
                setOpen(false);
              }}
            />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-2" align="start" onClick={() => setOpen(false)}>
        {children}
      </PopoverContent>
    </Popover>
  );
}

function formatShortPrice(val: string): string {
  const n = Number(val);
  if (n >= 1e9) return `${(n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1)} tỷ`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} tr`;
  return val;
}
