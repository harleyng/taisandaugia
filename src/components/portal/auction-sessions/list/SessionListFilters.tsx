import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stripViDiacritics } from "@/lib/normalizeVi";
import { AUCTION_FORMAT_LABELS } from "@/types/asset-posting";
import { SESSION_FORMATS } from "@/lib/auctionSessions/sessionForm";
import {
  customRangeError,
  TIME_FILTERS,
  timeFilterLabel,
  type TimeFilter,
} from "@/lib/auctionSessions/sessionList";
import { FilterDropdown, FilterOption } from "./FilterDropdown";

export interface SessionListFilterValues {
  q: string;
  time: TimeFilter;
  from: string;
  to: string;
  prov: string;
  fmt: string;
}

interface Props {
  values: SessionListFilterValues;
  /** Danh sách tỉnh đã gộp + bỏ trùng (trang dựng). */
  provinces: string[];
  onChange: (patch: Partial<SessionListFilterValues>) => void;
}

const INPUT =
  "h-[34px] rounded-lg border-0 bg-card px-2.5 text-[13px] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-primary";

/** Khoảng ngày tuỳ chỉnh trong dropdown thời gian (design `.rng`). */
function CustomRange({ from, to, onApply }: { from: string; to: string; onApply: (f: string, t: string) => void }) {
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const [err, setErr] = useState<string | null>(null);
  const apply = () => {
    const e = customRangeError(f, t);
    setErr(e);
    if (!e) onApply(f, t);
  };
  return (
    <div className="grid w-[280px] grid-cols-2 gap-2 px-1.5 pb-1.5 pt-2">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Từ ngày
        <input type="date" value={f} onChange={(e) => setF(e.target.value)} className={`${INPUT} min-w-0 px-2`} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Đến ngày
        <input type="date" value={t} onChange={(e) => setT(e.target.value)} className={`${INPUT} min-w-0 px-2`} />
      </label>
      {err && <span className="col-span-2 text-xs text-destructive">{err}</span>}
      <Button size="sm" className="col-span-2 h-[34px]" onClick={apply}>
        Áp dụng
      </Button>
    </div>
  );
}

/** Hàng lọc trong thẻ danh sách: tìm · thời gian · khu vực · hình thức (design `.lfb`). */
export function SessionListFilters({ values, provinces, onChange }: Props) {
  const [open, setOpen] = useState<"time" | "prov" | "fmt" | null>(null);
  const [custom, setCustom] = useState(false);
  const [provQ, setProvQ] = useState("");

  const toggle = (key: "time" | "prov" | "fmt") => (next: boolean) => {
    setOpen(next ? key : null);
    setCustom(false);
    setProvQ("");
  };
  const pick = (patch: Partial<SessionListFilterValues>) => {
    setOpen(null);
    setCustom(false);
    onChange(patch);
  };

  const foldedProvQ = stripViDiacritics(provQ.trim());
  const visibleProvinces = provinces.filter((p) => !foldedProvQ || stripViDiacritics(p).includes(foldedProvQ));
  const showAll = !foldedProvQ || stripViDiacritics("Mọi khu vực").includes(foldedProvQ);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3.5 sm:px-[22px]">
      <div className="relative min-w-[200px] flex-1">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          type="search"
          aria-label="Tìm phiên"
          placeholder="Tìm theo mã, tên phiên, tài sản"
          value={values.q}
          onChange={(e) => onChange({ q: e.target.value })}
          className={`${INPUT} w-full pl-8`}
        />
      </div>

      <FilterDropdown
        aria-label="Lọc theo thời gian đấu giá"
        label={timeFilterLabel(values.time, values.from, values.to)}
        open={open === "time"}
        onOpenChange={toggle("time")}
        className="sm:w-[230px]"
      >
        {TIME_FILTERS.map((t) => (
          <FilterOption key={t.key} selected={values.time === t.key} onSelect={() => pick({ time: t.key })}>
            {t.label}
          </FilterOption>
        ))}
        <div className="mx-0.5 my-1 h-px bg-border" />
        <FilterOption selected={values.time === "custom" || custom} onSelect={() => setCustom(true)}>
          Tuỳ chỉnh khoảng ngày…
        </FilterOption>
        {(custom || values.time === "custom") && (
          <CustomRange
            from={values.from}
            to={values.to}
            onApply={(from, to) => pick({ time: "custom", from, to })}
          />
        )}
      </FilterDropdown>

      <FilterDropdown
        aria-label="Lọc theo khu vực"
        label={values.prov || "Mọi khu vực"}
        open={open === "prov"}
        onOpenChange={toggle("prov")}
        className="sm:w-[220px]"
      >
        <label className="mx-0.5 mb-1 mt-0.5 flex h-[34px] items-center gap-1.5 rounded-[7px] px-2.5 text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] focus-within:shadow-[inset_0_0_0_1.5px_hsl(var(--primary))]">
          <Search className="h-[15px] w-[15px] shrink-0" strokeWidth={1.75} aria-hidden />
          <input
            autoFocus
            aria-label="Tìm tỉnh / thành"
            placeholder="Tìm tỉnh / thành"
            autoComplete="off"
            value={provQ}
            onChange={(e) => setProvQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              if (visibleProvinces[0]) pick({ prov: visibleProvinces[0] });
              else if (showAll) pick({ prov: "" });
            }}
            className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-foreground outline-none"
          />
        </label>
        <div className="flex max-h-[280px] w-[240px] flex-col overflow-y-auto">
          <FilterOption hidden={!showAll} selected={!values.prov} onSelect={() => pick({ prov: "" })}>
            Mọi khu vực
          </FilterOption>
          {visibleProvinces.map((p) => (
            <FilterOption key={p} selected={values.prov === p} onSelect={() => pick({ prov: p })}>
              {p}
            </FilterOption>
          ))}
          {!showAll && visibleProvinces.length === 0 && (
            <p className="p-2.5 text-center text-[12.5px] text-muted-foreground">Không tìm thấy tỉnh / thành</p>
          )}
        </div>
      </FilterDropdown>

      <FilterDropdown
        aria-label="Lọc theo hình thức"
        label={values.fmt ? AUCTION_FORMAT_LABELS[values.fmt as keyof typeof AUCTION_FORMAT_LABELS] : "Mọi hình thức"}
        open={open === "fmt"}
        onOpenChange={toggle("fmt")}
        className="sm:w-[160px]"
      >
        <FilterOption selected={!values.fmt} onSelect={() => pick({ fmt: "" })}>
          Mọi hình thức
        </FilterOption>
        {SESSION_FORMATS.map((f) => (
          <FilterOption key={f} selected={values.fmt === f} onSelect={() => pick({ fmt: f })}>
            {AUCTION_FORMAT_LABELS[f]}
          </FilterOption>
        ))}
      </FilterDropdown>
    </div>
  );
}
