import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface FilterDropdownProps {
  label: string;
  /** Tên cho trình đọc màn hình ("Lọc theo thời gian"…). */
  "aria-label": string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

/** Nút lọc thả xuống của hàng lọc danh sách phiên (design `.fdd` + `.pop`). */
export function FilterDropdown({ label, open, onOpenChange, children, className, ...rest }: FilterDropdownProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={rest["aria-label"]}
          className={cn(
            "flex h-[34px] w-full items-center gap-2 rounded-lg bg-card pl-2.5 pr-2.5 text-left text-[13px] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-primary sm:w-auto",
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={2.2} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="flex w-max min-w-[var(--radix-popover-trigger-width)] max-w-[300px] flex-col rounded-[10px] p-1 shadow-[0_10px_28px_hsl(var(--foreground)/0.12)]"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

interface OptionProps {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
  hidden?: boolean;
}

/** Một dòng chọn trong FilterDropdown (design `.o1`). */
export function FilterOption({ selected, onSelect, children, hidden }: OptionProps) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "whitespace-nowrap rounded-[7px] px-2.5 py-2 text-left text-[13px] text-foreground hover:bg-muted",
        selected && "bg-primary/10 font-semibold text-primary hover:bg-primary/10",
      )}
    >
      {children}
    </button>
  );
}
