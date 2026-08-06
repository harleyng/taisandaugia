import { useState } from "react";
import { ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  /** Dòng phụ mờ bên phải (vd số tin). */
  hint?: string;
}

interface Props {
  /** Nhãn hiển thị khi chưa chọn gì, vd "Tỉnh/thành". */
  label: string;
  /** `null` = chưa lọc. */
  value: string | null;
  valueLabel?: string;
  options: FilterOption[];
  onChange: (value: string | null, label: string) => void;
  /** Text của mục "bỏ lọc" đứng đầu danh sách. */
  allLabel: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  /**
   * Có truyền = lọc PHÍA SERVER: component tắt filter nội bộ của Command và
   * đẩy từ khóa lên cho cha query. Bỏ trống = lọc tại chỗ trên `options`.
   */
  onQueryChange?: (q: string) => void;
  loading?: boolean;
  emptyText?: string;
  className?: string;
}

/** Combobox chọn một — dùng cho các bộ lọc của báo cáo. Dumb, cha giữ state. */
export default function FilterCombobox({
  label,
  value,
  valueLabel,
  options,
  onChange,
  allLabel,
  searchable = false,
  searchPlaceholder = "Tìm…",
  onQueryChange,
  loading,
  emptyText = "Không có kết quả.",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const active = value !== null;
  const shown = active ? (valueLabel ?? options.find((o) => o.value === value)?.label ?? value) : label;

  const handleQuery = (next: string) => {
    setQ(next);
    onQueryChange?.(next);
  };

  const pick = (v: string | null, l: string) => {
    onChange(v, l);
    setOpen(false);
    handleQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-9 justify-between gap-2 font-normal min-w-[150px] max-w-[240px]",
            active && "border-primary/40 bg-primary/5 text-foreground",
            className,
          )}
        >
          <span className="truncate" title={shown}>
            {active && <span className="text-muted-foreground">{label}: </span>}
            {shown}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(320px,90vw)] p-0" align="start">
        <Command shouldFilter={!onQueryChange}>
          {searchable && (
            <CommandInput placeholder={searchPlaceholder} value={q} onValueChange={handleQuery} />
          )}
          <CommandList>
            {loading ? (
              <div className="py-6 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <>
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  <CommandItem value={allLabel} onSelect={() => pick(null, allLabel)}>
                    <Check className={cn("mr-2 h-4 w-4", !active ? "opacity-100 text-primary" : "opacity-0")} />
                    <span className="text-muted-foreground">{allLabel}</span>
                  </CommandItem>
                  {options.map((o) => (
                    <CommandItem
                      key={o.value}
                      // value dùng cho filter nội bộ của Command; khi lọc server thì vô hại
                      value={onQueryChange ? o.value : `${o.label} ${o.value}`}
                      onSelect={() => pick(o.value, o.label)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          value === o.value ? "opacity-100 text-primary" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{o.label}</span>
                      {o.hint && (
                        <span className="ml-auto pl-2 text-xs text-muted-foreground/70 tabular-nums shrink-0">
                          {o.hint}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
