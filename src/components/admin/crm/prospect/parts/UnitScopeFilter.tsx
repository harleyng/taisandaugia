import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { SCOPE_ALL } from "@/lib/prospects/auctionHistory";
import type { UnitTreeOption } from "@/lib/prospects/unitTree";

/**
 * Rail nối của cây (├ / └), một cột 20px cho mỗi cấp tổ tiên. Cột cuối vẽ khuỷu;
 * các cột trước chỉ vẽ kẻ dọc khi tổ tiên tương ứng CHƯA phải con út — nếu vẽ
 * hết thì cây có những đường thừa chạy xuống dưới mục cuối cùng.
 */
function TreeConnectors({
  level, isLastChild, ancestorLastFlags,
}: { level: number; isLastChild: boolean; ancestorLastFlags: boolean[] }) {
  if (level === 0) return null;
  return (
    <>
      {Array.from({ length: level }, (_, i) => {
        if (i === level - 1) {
          return (
            <span key={i} className="inline-flex w-5 shrink-0 relative self-stretch">
              <span
                className={cn(
                  "absolute left-2 border-l border-muted-foreground/30",
                  isLastChild ? "top-0 h-1/2" : "top-0 h-full",
                )}
              />
              <span className="absolute left-2 top-1/2 w-2 border-t border-muted-foreground/30" />
            </span>
          );
        }
        return (
          <span key={i} className="inline-flex w-5 shrink-0 relative self-stretch">
            {!ancestorLastFlags[i] && (
              <span className="absolute left-2 top-0 h-full border-l border-muted-foreground/30" />
            )}
          </span>
        );
      })}
    </>
  );
}

interface Props {
  options: UnitTreeOption[];
  value: string;
  onChange: (scope: string) => void;
  allLabel?: string;
}

/** Bộ lọc "Chi nhánh/AMC" — cụm ở cấp 0, đơn vị ở cấp 1, chọn cấp nào cũng được.
 *  Nhãn tránh chữ "cụm" ở nghĩa "cả nhà": nó đã mang nghĩa nhóm do người tự đặt
 *  tên (Cụm miền Bắc) ngay trong chính cây này. */
export function UnitScopeFilter({
  options, value, onChange, allLabel = "Toàn bộ chi nhánh",
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const active = value !== SCOPE_ALL;
  const shown = options.find((o) => o.value === value)?.label ?? allLabel;

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQ("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-9 justify-between gap-2 font-normal min-w-[170px] max-w-[280px]",
            active && "border-primary/40 bg-primary/5 text-foreground",
          )}
        >
          <span className="truncate" title={shown}>
            {active && <span className="text-muted-foreground">Chi nhánh/AMC: </span>}
            {shown}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(380px,92vw)] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Tìm chi nhánh, AMC hoặc cụm…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            <CommandEmpty>Không có đơn vị nào khớp.</CommandEmpty>
            <CommandGroup>
              <CommandItem value={allLabel} onSelect={() => pick(SCOPE_ALL)}>
                <Check className={cn("mr-2 h-4 w-4", !active ? "opacity-100 text-primary" : "opacity-0")} />
                <span className="text-muted-foreground">{allLabel}</span>
              </CommandItem>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.value}`}
                  onSelect={() => pick(o.value)}
                  className="items-stretch"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0 self-center",
                      value === o.value ? "opacity-100 text-primary" : "opacity-0",
                    )}
                  />
                  {/* Đang tìm kiếm thì bỏ rail: tổ tiên có thể đã bị lọc mất,
                      rail treo lơ lửng trông như cây gãy. */}
                  {q ? (
                    <span style={{ paddingLeft: `${o.level * 1.25}rem` }} />
                  ) : (
                    <TreeConnectors
                      level={o.level}
                      isLastChild={o.isLastChild}
                      ancestorLastFlags={o.ancestorLastFlags}
                    />
                  )}
                  <span
                    className={cn(
                      "flex-1 truncate self-center",
                      o.level === 0 && "font-medium",
                      o.level > 0 && "ml-1",
                    )}
                    title={o.label}
                  >
                    {o.label}
                  </span>
                  <span className="ml-2 shrink-0 self-center text-xs text-muted-foreground tabular-nums">
                    {o.count}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
