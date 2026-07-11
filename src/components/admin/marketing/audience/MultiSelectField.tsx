import { useState, type MouseEvent } from "react";
import { ChevronsUpDown, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface Props {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  searchable?: boolean;
  emptyText?: string;
  /** Số badge hiển thị trước khi gộp thành "+x". */
  maxBadges?: number;
  disabled?: boolean;
}

/** Select nhiều — hiển thị lựa chọn dạng badge ngay trong field, quá nhiều thì "+x". */
export function MultiSelectField({
  options,
  selected,
  onChange,
  placeholder = "Chọn…",
  searchPlaceholder = "Tìm…",
  searchable = false,
  emptyText = "Không có kết quả.",
  maxBadges = 2,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);

  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const remove = (v: string, e: MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((x) => x !== v));
  };

  const shown = selected.slice(0, maxBadges);
  const overflow = selected.length - shown.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-auto min-h-10 w-full justify-between gap-1.5 py-1.5 font-normal"
        >
          <span className="flex flex-1 flex-wrap items-center gap-1 overflow-hidden">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              <>
                {shown.map((v) => (
                  <Badge key={v} variant="secondary" className="max-w-[170px] gap-1">
                    <span className="truncate">{labelOf(v)}</span>
                    <span
                      role="button"
                      tabIndex={-1}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => remove(v, e)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </Badge>
                ))}
                {overflow > 0 && <Badge variant="secondary">+{overflow}</Badge>}
              </>
            )}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          {searchable && <CommandInput placeholder={searchPlaceholder} />}
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const active = selected.includes(o.value);
                return (
                  <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        active ? "opacity-100 text-primary" : "opacity-0",
                      )}
                    />
                    {o.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
