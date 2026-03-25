import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { CalendarIcon, X, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ASSET_CATEGORIES } from "@/constants/category.constants";
import { vietnamProvinces } from "@/constants/vietnam-locations";
import {
  type AuctionFilters,
  defaultAuctionFilters,
  STATUS_OPTIONS,
  LEGAL_CATEGORIES,
} from "@/types/auction-filters.types";

interface AuctionFilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AuctionFilters;
  onApply: (filters: AuctionFilters) => void;
}

export function AuctionFilterDialog({ open, onOpenChange, filters, onApply }: AuctionFilterDialogProps) {
  const isMobile = useIsMobile();
  const [draft, setDraft] = useState<AuctionFilters>(filters);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Sync draft when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) setDraft(filters);
    onOpenChange(v);
  };

  const update = (key: keyof AuctionFilters, value: any) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const handleApply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  const handleReset = () => {
    setDraft({ ...defaultAuctionFilters });
  };

  const selectedProvince = vietnamProvinces.find((p) => p.name === draft.province);

  const content = (
    <>
        {/* Category */}
        <FilterSection title="Loại tài sản">
          <div className="space-y-0.5">
            <button
              onClick={() => update("category", "")}
              className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${
                !draft.category ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"
              }`}
            >
              Tất cả
            </button>
            {ASSET_CATEGORIES.map((cat) => {
              const isExpanded = expandedCategory === cat.slug;
              const isActive = draft.category === cat.slug || cat.children.some(c => c.slug === draft.category);
              return (
                <div key={cat.slug}>
                  <button
                    onClick={() => {
                      update("category", cat.slug);
                      setExpandedCategory(isExpanded ? null : cat.slug);
                    }}
                    className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors flex items-center justify-between ${
                      isActive ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"
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
                            draft.category === child.slug ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
        </FilterSection>

        <Separator />

        {/* Status */}
        <FilterSection title="Trạng thái phiên">
          <RadioGroup
            value={draft.sessionStatus || "all"}
            onValueChange={(v) => update("sessionStatus", v === "all" ? "" : v)}
            className="space-y-1"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="all" id="adv-status-all" className="h-3.5 w-3.5" />
              <Label htmlFor="adv-status-all" className="text-sm cursor-pointer">Tất cả</Label>
            </div>
            {STATUS_OPTIONS.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupItem value={opt.value} id={`adv-status-${opt.value}`} className="h-3.5 w-3.5" />
                <Label htmlFor={`adv-status-${opt.value}`} className="text-sm cursor-pointer">{opt.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </FilterSection>

        <Separator />

        {/* Location 2-level */}
        <FilterSection title="Địa điểm đấu giá">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Địa chỉ sau sáp nhập</Label>
              <Switch
                checked={draft.useMergedAddress}
                onCheckedChange={(v) => update("useMergedAddress", v)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Tỉnh/Thành phố</Label>
              <ScrollArea className="max-h-[150px] border rounded-md">
                <div className="p-1 space-y-0.5">
                  <button
                    onClick={() => { update("province", ""); update("district", ""); }}
                    className={`w-full text-left text-sm px-2 py-1 rounded-md ${!draft.province ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}
                  >
                    Tất cả
                  </button>
                  {vietnamProvinces.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => { update("province", p.name); update("district", ""); }}
                      className={`w-full text-left text-sm px-2 py-1 rounded-md ${draft.province === p.name ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
            {selectedProvince && selectedProvince.districts.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Quận/Huyện</Label>
                <ScrollArea className="max-h-[150px] border rounded-md">
                  <div className="p-1 space-y-0.5">
                    <button
                      onClick={() => update("district", "")}
                      className={`w-full text-left text-sm px-2 py-1 rounded-md ${!draft.district ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}
                    >
                      Tất cả
                    </button>
                    {selectedProvince.districts.map((d) => (
                      <button
                        key={d.name}
                        onClick={() => update("district", d.name)}
                        className={`w-full text-left text-sm px-2 py-1 rounded-md ${draft.district === d.name ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted"}`}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </FilterSection>

        <Separator />

        {/* Price range */}
        <FilterSection title="Giá khởi điểm">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Từ (VNĐ)"
              value={draft.priceMin}
              onChange={(e) => update("priceMin", e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              type="number"
              placeholder="Đến (VNĐ)"
              value={draft.priceMax}
              onChange={(e) => update("priceMax", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </FilterSection>

        <Separator />

        {/* Deposit range */}
        <FilterSection title="Tiền đặt trước">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Từ (VNĐ)"
              value={draft.depositMin}
              onChange={(e) => update("depositMin", e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              type="number"
              placeholder="Đến (VNĐ)"
              value={draft.depositMax}
              onChange={(e) => update("depositMax", e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </FilterSection>

        <Separator />

        {/* Publish date range */}
        <FilterSection title="Thời gian công bố">
          <div className="flex gap-2">
            <DatePickerField
              label="Từ ngày"
              value={draft.publishDateFrom}
              onChange={(d) => update("publishDateFrom", d)}
            />
            <DatePickerField
              label="Đến ngày"
              value={draft.publishDateTo}
              onChange={(d) => update("publishDateTo", d)}
            />
          </div>
        </FilterSection>

        <Separator />

        {/* Legal category */}
        <FilterSection title="Danh mục pháp lý">
          <RadioGroup
            value={draft.legalCategory || "all"}
            onValueChange={(v) => update("legalCategory", v === "all" ? "" : v)}
            className="space-y-1"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="all" id="adv-legal-all" className="h-3.5 w-3.5" />
              <Label htmlFor="adv-legal-all" className="text-sm cursor-pointer">Tất cả</Label>
            </div>
            {LEGAL_CATEGORIES.map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupItem value={opt.value} id={`adv-legal-${opt.value}`} className="h-3.5 w-3.5" />
                <Label htmlFor={`adv-legal-${opt.value}`} className="text-sm cursor-pointer">{opt.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </FilterSection>
    </>
  );

  const footer = (
    <div className="flex gap-2 w-full">
      <Button variant="outline" onClick={handleReset} className="flex-1">
        <X className="h-4 w-4 mr-1" /> Xóa bộ lọc
      </Button>
      <Button onClick={handleApply} className="flex-1">
        Áp dụng
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="h-[85vh] flex flex-col">
          <SheetHeader>
            <SheetTitle>Bộ lọc nâng cao</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-6 py-2">{content}</div>
          </div>
          <SheetFooter className="mt-2">{footer}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0" style={{ display: 'flex', flexDirection: 'column', height: '85vh', maxHeight: '85vh' }}>
        <div className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle>Bộ lọc nâng cao</DialogTitle>
        </div>
        <div className="flex-1 overflow-y-auto px-6" style={{ minHeight: 0 }}>
          <div className="space-y-6 py-2">
            {content}
          </div>
        </div>
        <div className="px-6 pb-6 pt-4 shrink-0 border-t">{footer}</div>
      </DialogContent>
    </Dialog>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-sm text-foreground mb-2">{title}</h3>
      {children}
    </div>
  );
}

function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "flex-1 h-8 justify-start text-left text-sm font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-1 h-3.5 w-3.5" />
          {value ? format(value, "dd/MM/yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
