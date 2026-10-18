import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SESSION_PHASE_FILTERS, type SessionFilters } from "@/lib/auctionSessions/filters";

interface Props {
  filters: SessionFilters;
  onChange: (next: SessionFilters) => void;
  provinces: string[];
}

const FORMAT_OPTIONS = [
  { value: "truc_tuyen", label: "Trực tuyến" },
  { value: "truc_tiep", label: "Trực tiếp" },
];

const field = "h-10 border-0 bg-card shadow-none focus:ring-2 focus:ring-primary focus:ring-offset-1";

export function SessionFilterBar({ filters, onChange, provinces }: Props) {
  const set = <K extends keyof SessionFilters>(key: K, value: SessionFilters[K]) => onChange({ ...filters, [key]: value });

  return (
    <div className="sticky top-16 z-10 -mx-4 mb-6 mt-4 flex flex-wrap items-center gap-3 bg-muted/85 px-4 py-3 backdrop-blur-sm">
      <div className="relative min-w-0 flex-[1_1_280px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.q}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Tìm theo tên phiên, mã phiên, tổ chức…"
          className={`${field} rounded-md pl-9 focus-visible:ring-2 focus-visible:ring-primary`}
        />
      </div>
      <div className="grid w-full grid-cols-1 gap-3 sm:flex sm:w-auto sm:flex-wrap">
        <Select value={filters.province} onValueChange={(v) => set("province", v)}>
          <SelectTrigger className={`${field} sm:w-[170px]`}>
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
          <SelectTrigger className={`${field} sm:w-[170px]`}>
            <SelectValue placeholder="Hình thức" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi hình thức</SelectItem>
            {FORMAT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.phase} onValueChange={(v) => set("phase", v)}>
          <SelectTrigger className={`${field} sm:w-[170px]`}>
            <SelectValue placeholder="Giai đoạn" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi giai đoạn</SelectItem>
            {SESSION_PHASE_FILTERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
