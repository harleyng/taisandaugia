import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Search, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

export interface AdListFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
}

interface Props {
  filters: AdListFilters;
  onChange: (filters: AdListFilters) => void;
}

export function AdFilterBar({ filters, onChange }: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const set = (key: keyof AdListFilters) => (value: string) => onChange({ ...filters, [key]: value });

  const dateRange: DateRange = {
    from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
    to: filters.dateTo ? new Date(filters.dateTo) : undefined,
  };
  const hasDateFilter = filters.dateFrom || filters.dateTo;
  const dateLabel = hasDateFilter
    ? [
        filters.dateFrom ? format(new Date(filters.dateFrom), "dd/MM/yyyy") : "…",
        filters.dateTo ? format(new Date(filters.dateTo), "dd/MM/yyyy") : "…",
      ].join(" – ")
    : "Thời gian tạo";

  const handleDateSelect = (range: DateRange | undefined) => {
    onChange({
      ...filters,
      dateFrom: range?.from ? format(range.from, "yyyy-MM-dd") : "",
      dateTo: range?.to ? format(range.to, "yyyy-MM-dd") : "",
    });
    if (range?.from && range?.to) setCalendarOpen(false);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Nhập tên hoặc mã chiến dịch…"
          value={filters.search}
          onChange={(e) => set("search")(e.target.value)}
          className="pl-8"
        />
      </div>

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-10 gap-1.5 text-sm font-normal ${hasDateFilter ? "border-primary text-primary" : "text-muted-foreground"}`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {dateLabel}
            {hasDateFilter && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange({ ...filters, dateFrom: "", dateTo: "" });
                }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar mode="range" selected={dateRange} onSelect={handleDateSelect} numberOfMonths={2} initialFocus />
        </PopoverContent>
      </Popover>
    </div>
  );
}
