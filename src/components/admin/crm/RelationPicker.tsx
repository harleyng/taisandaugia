import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCrmRelationOptions } from "@/hooks/useCrmRelationOptions";
import { RELATION_LABELS, type CrmRelationKind, type ResolvedRelation } from "@/lib/crm/relation";

const NONE = "__none__";

const PLACEHOLDER: Record<CrmRelationKind, string> = {
  lead: "Chọn khách tiềm năng…",
  customer: "Chọn khách hàng…",
  opportunity: "Chọn cơ hội…",
  order: "Chọn đơn hàng…",
};

interface Props {
  value: ResolvedRelation | null;
  onChange: (value: ResolvedRelation | null) => void;
}

/**
 * Gắn công việc/ticket vào MỘT đối tượng CRM. Dùng chung cho hai dialog ở cổng
 * tập trung lẫn panel trang chi tiết — DB chỉ cho đúng một cột FK có giá trị.
 */
export function RelationPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const kind = value?.kind ?? null;
  const { data: options, isLoading } = useCrmRelationOptions(kind);

  // Panel chi tiết truyền sẵn id nhưng chưa có nhãn — bù lại khi danh sách về.
  const selected = value ? options?.find((o) => o.id === value.id) : undefined;
  const shown = selected?.label || value?.label || (value ? "Đang tải…" : "");

  const setKind = (next: string) => {
    if (next === NONE) return onChange(null);
    // Đổi loại thì bỏ đối tượng cũ, mở luôn danh sách của loại mới.
    onChange({ kind: next as CrmRelationKind, id: "", label: "", code: null });
    setOpen(true);
  };

  return (
    <div className="space-y-1.5">
      <Label>Đối tượng liên quan</Label>
      <div className="grid grid-cols-[160px_1fr] gap-2">
        <Select value={kind ?? NONE} onValueChange={setKind}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Không gắn</SelectItem>
            {(Object.keys(RELATION_LABELS) as CrmRelationKind[]).map((k) => (
              <SelectItem key={k} value={k}>{RELATION_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={!kind}
              className="justify-between gap-2 font-normal"
            >
              <span className={cn("truncate", !value?.id && "text-muted-foreground")}>
                {value?.id ? shown : kind ? PLACEHOLDER[kind] : "Chưa gắn đối tượng"}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[min(360px,90vw)] p-0" align="start">
            <Command>
              <CommandInput placeholder="Tìm theo tên hoặc mã…" />
              <CommandList>
                {isLoading ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  <>
                    <CommandEmpty>Không có kết quả.</CommandEmpty>
                    <CommandGroup>
                      {(options ?? []).map((o) => (
                        <CommandItem
                          key={o.id}
                          value={`${o.label} ${o.code ?? ""}`}
                          onSelect={() => {
                            onChange({ kind: kind as CrmRelationKind, id: o.id, label: o.label, code: o.code });
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              value?.id === o.id ? "opacity-100 text-primary" : "opacity-0",
                            )}
                          />
                          <span className="truncate">{o.label}</span>
                          {o.code && (
                            <span className="ml-auto pl-2 text-xs text-muted-foreground/70 shrink-0">
                              {o.code}
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
      </div>
    </div>
  );
}
