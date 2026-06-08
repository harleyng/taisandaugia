import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import type { PortfolioFilter } from "@/hooks/useOwnerPortfolioMetrics";

interface Props {
  filter: PortfolioFilter;
  onChange: (f: PortfolioFilter) => void;
  availablePropertyTypes: string[];
  availableProvinces: string[];
  availableOrgs: { id: string; name: string }[];
}

function MultiSelectGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  if (!options.length) return null;
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onToggle(opt)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:border-primary/60"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FilterDimensions({ filter, onChange, availablePropertyTypes, availableProvinces, availableOrgs }: Props) {
  const toggle = (dim: keyof PortfolioFilter, value: string) => {
    const arr = (filter[dim] as string[] | undefined) ?? [];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    onChange({ ...filter, [dim]: next.length ? next : undefined });
  };

  const setDate = (key: "dateFrom" | "dateTo", value: string) => {
    onChange({ ...filter, [key]: value || undefined });
  };

  const hasFilter =
    (filter.propertyTypeSlugs?.length ?? 0) > 0 ||
    (filter.provinces?.length ?? 0) > 0 ||
    (filter.auctionOrgIds?.length ?? 0) > 0 ||
    !!filter.dateFrom || !!filter.dateTo;

  return (
    <div className="space-y-5">
      <MultiSelectGroup
        label="Loại tài sản"
        options={availablePropertyTypes}
        selected={filter.propertyTypeSlugs ?? []}
        onToggle={(v) => toggle("propertyTypeSlugs", v)}
      />
      <MultiSelectGroup
        label="Tỉnh / Thành phố"
        options={availableProvinces}
        selected={filter.provinces ?? []}
        onToggle={(v) => toggle("provinces", v)}
      />
      <MultiSelectGroup
        label="Tổ chức đấu giá"
        options={availableOrgs.map((o) => o.id)}
        selected={filter.auctionOrgIds ?? []}
        onToggle={(v) => toggle("auctionOrgIds", v)}
      />

      {/* Org names rendered as display labels */}
      {(filter.auctionOrgIds?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5 -mt-3">
          {filter.auctionOrgIds!.map((id) => {
            const org = availableOrgs.find((o) => o.id === id);
            return (
              <Badge key={id} variant="secondary" className="gap-1">
                {org?.name ?? id}
                <button onClick={() => toggle("auctionOrgIds", id)}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Date range */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Khoảng thời gian (ngày đấu giá)
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Từ</Label>
            <Input
              type="date"
              value={filter.dateFrom ?? ""}
              onChange={(e) => setDate("dateFrom", e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Đến</Label>
            <Input
              type="date"
              value={filter.dateTo ?? ""}
              onChange={(e) => setDate("dateTo", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Reset */}
      {hasFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => onChange({})}
        >
          <X className="w-3.5 h-3.5 mr-1" />
          Xóa bộ lọc
        </Button>
      )}
    </div>
  );
}
