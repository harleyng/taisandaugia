import { forwardRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PROVINCE_GROUPS, ALL_PROVINCES,
  ASSET_TYPE_OPTIONS, TIME_PERIOD_OPTIONS,
  LEGAL_TYPE_OPTIONS, PRICE_RANGE_OPTIONS,
} from "@/lib/mockOppReport";

// ── Province selector (Popover + Command, grouped) ──────────────────────────
const ProvinceSelector = ({
  selected, onChange,
}: { selected: string[]; onChange: (v: string[]) => void }) => {
  const [open, setOpen] = useState(false);

  const toggle = (p: string) =>
    onChange(selected.includes(p) ? selected.filter((x) => x !== p) : [...selected, p]);

  const toggleGroup = (provinces: string[]) => {
    const allIn = provinces.every((p) => selected.includes(p));
    if (allIn) onChange(selected.filter((p) => !provinces.includes(p)));
    else onChange([...new Set([...selected, ...provinces])]);
  };

  const label =
    selected.length === 0
      ? "Chọn tỉnh / thành"
      : selected.length === ALL_PROVINCES.length
      ? "Tất cả 63 tỉnh thành"
      : selected.length <= 3
      ? selected.join(", ")
      : `${selected.slice(0, 2).join(", ")} +${selected.length - 2}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center justify-between gap-2 min-w-[220px] max-w-xs px-3 py-2 rounded-md border text-xs font-medium transition-colors text-left",
            selected.length > 0
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:border-primary/60 hover:text-foreground",
          )}
        >
          <span className="truncate flex-1">{label}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {selected.length > 0 && selected.length < ALL_PROVINCES.length && (
              <span
                className="rounded-full bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 flex items-center justify-center leading-none"
                onClick={(e) => { e.stopPropagation(); onChange([]); }}
              >
                <X className="h-2.5 w-2.5" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder="Tìm tỉnh / thành…" className="text-xs" />
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
            <button
              className="text-[10.5px] font-semibold text-primary hover:underline"
              onClick={() => onChange(ALL_PROVINCES)}
            >
              Chọn tất cả
            </button>
            <span className="text-[10px] text-muted-foreground">
              {selected.length}/{ALL_PROVINCES.length} đã chọn
            </span>
            <button
              className="text-[10.5px] font-semibold text-muted-foreground hover:underline"
              onClick={() => onChange([])}
            >
              Bỏ chọn
            </button>
          </div>
          <CommandList className="max-h-64">
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">Không tìm thấy tỉnh thành.</CommandEmpty>
            {PROVINCE_GROUPS.map((group) => {
              const groupAllSelected = group.provinces.every((p) => selected.includes(p));
              const groupSomeSelected = group.provinces.some((p) => selected.includes(p));
              return (
                <CommandGroup key={group.label} heading={
                  <div className="flex items-center gap-2 py-0.5">
                    <Checkbox
                      checked={groupAllSelected}
                      className={cn("h-3.5 w-3.5", groupSomeSelected && !groupAllSelected && "opacity-50")}
                      onCheckedChange={() => toggleGroup(group.provinces)}
                    />
                    <span>{group.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      {group.provinces.filter((p) => selected.includes(p)).length}/{group.provinces.length}
                    </span>
                  </div>
                }>
                  {group.provinces.map((p) => (
                    <CommandItem
                      key={p}
                      value={p}
                      onSelect={() => toggle(p)}
                      className="text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Check className={cn("h-3.5 w-3.5 flex-shrink-0", selected.includes(p) ? "opacity-100 text-primary" : "opacity-0")} />
                      {p}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// ── Chip (lighter active so multiple-selected doesn't look overwhelming) ─────
const Chip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-3 py-1.5 rounded-md text-xs font-medium border transition-all select-none whitespace-nowrap",
      active
        ? "bg-primary/10 border-primary text-primary font-semibold"
        : "bg-background border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
    )}
  >
    {label}
  </button>
);

// ── Segment button ────────────────────────────────────────────────────────────
const SegBtn = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-3 py-1.5 text-xs font-medium border-r border-border last:border-r-0 transition-colors whitespace-nowrap",
      active ? "bg-primary text-primary-foreground font-semibold" : "bg-background text-muted-foreground hover:bg-muted",
    )}
  >
    {label}
  </button>
);

// ── Small text input ──────────────────────────────────────────────────────────
const RangeInput = ({ value, onChange, placeholder, suffix }: {
  value: string; onChange: (v: string) => void; placeholder?: string; suffix?: string;
}) => (
  <div className="flex items-center gap-1">
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-24 font-mono text-xs px-2.5 py-1.5 border border-border rounded-md bg-background focus:outline-none focus:border-primary"
    />
    {suffix && <span className="font-mono text-[10px] text-muted-foreground">{suffix}</span>}
  </div>
);

// ── Label helpers ─────────────────────────────────────────────────────────────
const FilterLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{children}</span>
);
const Light = ({ children }: { children: React.ReactNode }) => (
  <span className="normal-case font-normal">{children}</span>
);

// ── Props ─────────────────────────────────────────────────────────────────────
interface OppFilterBarProps {
  regions: string[];
  setRegions: (v: string[]) => void;
  assetTypes: string[];
  setAssetTypes: (v: string[]) => void;
  timePeriod: string;
  setTimePeriod: (v: string) => void;
  legalTypes: string[];
  setLegalTypes: (v: string[]) => void;
  priceRange: string;
  setPriceRange: (v: string) => void;
  areaMin: string;
  setAreaMin: (v: string) => void;
  areaMax: string;
  setAreaMax: (v: string) => void;
}

// ── Main component ────────────────────────────────────────────────────────────
export const OppFilterBar = forwardRef<HTMLDivElement, OppFilterBarProps>(
  ({
    regions, setRegions,
    assetTypes, setAssetTypes,
    timePeriod, setTimePeriod,
    legalTypes, setLegalTypes,
    priceRange, setPriceRange,
    areaMin, setAreaMin,
    areaMax, setAreaMax,
  }, ref) => {
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [customDateFrom, setCustomDateFrom] = useState("");
    const [customDateTo, setCustomDateTo] = useState("");
    const [customPriceMin, setCustomPriceMin] = useState("");
    const [customPriceMax, setCustomPriceMax] = useState("");

    const hasBds = assetTypes.includes("bds");

    const toggleAssetType = (id: string) =>
      setAssetTypes(assetTypes.includes(id) ? assetTypes.filter((x) => x !== id) : [...assetTypes, id]);
    const toggleLegal = (id: string) =>
      setLegalTypes(legalTypes.includes(id) ? legalTypes.filter((x) => x !== id) : [...legalTypes, id]);

    const resetAll = () => {
      setRegions(["Hà Nội", "TP. Hồ Chí Minh"]);
      setAssetTypes(["bds", "xe", "mm", "hh", "dd", "khac"]);
      setTimePeriod("60");
      setLegalTypes(LEGAL_TYPE_OPTIONS.map((l) => l.id));
      setPriceRange("all");
      setAreaMin("80");
      setAreaMax("500");
      setCustomDateFrom(""); setCustomDateTo("");
      setCustomPriceMin(""); setCustomPriceMax("");
    };

    return (
      <div ref={ref} className="bg-card border border-border rounded-xl shadow-md overflow-hidden mb-6">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <SlidersHorizontal className="h-3.5 w-3.5 text-primary-foreground" />
            </span>
            <h3 className="font-semibold text-sm">Tiêu chí phân khúc thị trường</h3>
          </div>
          <button
            onClick={resetAll}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            <RotateCcw className="h-3 w-3" />
            Đặt lại
          </button>
        </div>

        {/* Basic filters — row 1: Khu vực + Loại tài sản */}
        <div className="px-5 pt-4 pb-3 flex flex-wrap gap-x-8 gap-y-4 items-start border-b border-border/50">
          {/* Khu vực */}
          <div className="flex flex-col gap-2">
            <FilterLabel>Khu vực <Light>· nhiều · 63 tỉnh thành</Light></FilterLabel>
            <ProvinceSelector selected={regions} onChange={setRegions} />
          </div>

          {/* Loại tài sản */}
          <div className="flex flex-col gap-2">
            <FilterLabel>Loại tài sản <Light>· nhiều</Light></FilterLabel>
            <div className="flex flex-wrap gap-1.5">
              {ASSET_TYPE_OPTIONS.map((t) => (
                <Chip key={t.id} label={t.label} active={assetTypes.includes(t.id)} onClick={() => toggleAssetType(t.id)} />
              ))}
            </div>
          </div>
        </div>

        {/* Basic filters — row 2: Thời gian */}
        <div className="px-5 pt-3 pb-4 flex flex-col gap-2">
          <FilterLabel>Thời gian tổ chức</FilterLabel>
          <div className="flex border border-border rounded-md overflow-hidden w-fit">
            {TIME_PERIOD_OPTIONS.map((t) => (
              <SegBtn key={t.id} label={t.label} active={timePeriod === t.id} onClick={() => setTimePeriod(t.id)} />
            ))}
            <SegBtn label="Tuỳ chọn" active={timePeriod === "custom"} onClick={() => setTimePeriod("custom")} />
          </div>
          {timePeriod === "custom" && (
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <RangeInput value={customDateFrom} onChange={setCustomDateFrom} placeholder="dd/mm/yyyy" />
              <span className="text-xs text-muted-foreground">–</span>
              <RangeInput value={customDateTo} onChange={setCustomDateTo} placeholder="dd/mm/yyyy" />
            </div>
          )}
        </div>

        {/* Expand bar */}
        <div className="flex items-center justify-between px-5 py-2.5 border-t border-dashed border-border bg-card">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">+3</span>
            <span>Lọc nâng cao · loại pháp lý, giá khởi điểm, diện tích</span>
          </div>
          <button
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:bg-primary/10 px-2 py-1 rounded-md transition-colors"
          >
            {advancedOpen ? "Đóng lọc nâng cao" : "Mở lọc nâng cao"}
            {advancedOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Advanced filters */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 bg-muted/30 border-t border-border",
            advancedOpen ? "max-h-[800px] opacity-100 py-5 px-5" : "max-h-0 opacity-0 py-0 px-5",
          )}
        >
          <p className="font-mono text-[10px] font-bold tracking-widest uppercase text-amber-600 mb-4 flex items-center gap-2 after:flex-1 after:h-px after:bg-border">
            ⸬ Lọc nâng cao
          </p>
          <div className="flex flex-col gap-5">

            {/* Loại pháp lý — chips flex-wrap (15 items) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <FilterLabel>Loại pháp lý <Light>· nhiều</Light></FilterLabel>
                <div className="flex gap-3 text-[10.5px]">
                  <button
                    className="text-primary hover:underline font-semibold"
                    onClick={() => setLegalTypes(LEGAL_TYPE_OPTIONS.map((l) => l.id))}
                  >
                    Chọn tất cả
                  </button>
                  <button
                    className="text-muted-foreground hover:underline"
                    onClick={() => setLegalTypes([])}
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {LEGAL_TYPE_OPTIONS.map((l) => (
                  <Chip key={l.id} label={l.label} active={legalTypes.includes(l.id)} onClick={() => toggleLegal(l.id)} />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-5 items-start">
              {/* Giá khởi điểm */}
              <div className="flex flex-col gap-2">
                <FilterLabel>Giá khởi điểm <Light>· preset bậc thang</Light></FilterLabel>
                <div className="flex border border-border rounded-md overflow-hidden flex-wrap">
                  {PRICE_RANGE_OPTIONS.map((p) => (
                    <SegBtn key={p.id} label={p.label} active={priceRange === p.id} onClick={() => setPriceRange(p.id)} />
                  ))}
                  <SegBtn label="Tuỳ chọn" active={priceRange === "custom"} onClick={() => setPriceRange("custom")} />
                </div>
                {priceRange === "custom" && (
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <RangeInput value={customPriceMin} onChange={setCustomPriceMin} placeholder="VD: 2" suffix="tỷ" />
                    <span className="text-xs text-muted-foreground">–</span>
                    <RangeInput value={customPriceMax} onChange={setCustomPriceMax} placeholder="VD: 50" suffix="tỷ" />
                  </div>
                )}
              </div>

              {/* Diện tích (BĐS only) */}
              <div className={cn("flex flex-col gap-2 transition-opacity", !hasBds && "opacity-40 pointer-events-none")}>
                <FilterLabel>Diện tích <Light>· adaptive · BĐS</Light></FilterLabel>
                <div className="flex items-center gap-2">
                  <RangeInput value={areaMin} onChange={setAreaMin} placeholder="80" suffix="–" />
                  <RangeInput value={areaMax} onChange={setAreaMax} placeholder="500" suffix="m²" />
                </div>
                <span className="font-mono text-[9px] text-muted-foreground">⌀ chỉ áp dụng khi lọc Bất động sản</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    );
  },
);

OppFilterBar.displayName = "OppFilterBar";
