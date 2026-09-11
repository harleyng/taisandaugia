import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import { SESSION_STATUS_LABELS, SESSION_STATUS_ORDER } from "@/lib/listings/sessionStatus";
import type { SessionFilters } from "@/lib/auctionSessions/filters";


interface Props {
  filters: SessionFilters;
  onChange: (next: SessionFilters) => void;
  provinces: string[];
  includeEnded: boolean;
  onIncludeEndedChange: (v: boolean) => void;
}

export function SessionFilterBar({ filters, onChange, provinces, includeEnded, onIncludeEndedChange }: Props) {
  const set = <K extends keyof SessionFilters>(key: K, value: SessionFilters[K]) => onChange({ ...filters, [key]: value });
  const phases = SESSION_STATUS_ORDER.filter((p) => includeEnded || p !== "ended");

  return (
    <div className="sticky top-16 z-10 -mx-4 mb-6 bg-background/80 px-4 py-3 backdrop-blur-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Tìm theo tên phiên, mã phiên, tổ chức…"
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex">
          <Select value={filters.province} onValueChange={(v) => set("province", v)}>
            <SelectTrigger className="lg:w-[170px]">
              <SelectValue placeholder="Tỉnh / thành" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi tỉnh / thành</SelectItem>
              {provinces.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.format} onValueChange={(v) => set("format", v)}>
            <SelectTrigger className="lg:w-[170px]">
              <SelectValue placeholder="Hình thức" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi hình thức</SelectItem>
              {Object.entries(AUCTION_FORMAT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.phase} onValueChange={(v) => set("phase", v)}>
            <SelectTrigger className="lg:w-[170px]">
              <SelectValue placeholder="Giai đoạn" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi giai đoạn</SelectItem>
              {phases.map((p) => (
                <SelectItem key={p} value={p}>
                  {SESSION_STATUS_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 lg:pl-2">
          <Switch id="include-ended" checked={includeEnded} onCheckedChange={onIncludeEndedChange} />
          <Label htmlFor="include-ended" className="whitespace-nowrap text-sm text-muted-foreground">
            Gồm phiên đã kết thúc
          </Label>
        </div>
      </div>
    </div>
  );
}
