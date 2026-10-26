import { useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminUnits } from "@/hooks/useAdminUnits";
import { ADMIN_UNIT_TYPE_LABELS, matchesAdminUnit } from "@/lib/adminUnits";
import { cn } from "@/lib/utils";

interface Props {
  provinceCode: string | null;
  value: string[];
  onChange: (codes: string[]) => void;
  /** Mã đã có chi nhánh trong Trạm — vẫn chọn được, chỉ hiện nhãn "đã có". */
  existing?: Set<string>;
  disabled?: boolean;
}

/**
 * Chọn NHIỀU xã / phường / đặc khu của một tỉnh. `AdminUnitPicker` chỉ chọn một
 * đơn vị, còn khởi tạo tỉnh thì bình thường chọn cả 90–100 xã một lượt, nên
 * danh sách ở đây là bảng tick có "Chọn tất cả".
 */
export function CommuneMultiSelect({ provinceCode, value, onChange, existing, disabled }: Props) {
  const { data: units, isLoading } = useAdminUnits(provinceCode);
  const [term, setTerm] = useState("");

  const shown = useMemo(() => {
    const list = units ?? [];
    const q = term.trim();
    return q ? list.filter((u) => matchesAdminUnit(u, q)) : list;
  }, [units, term]);

  const selected = useMemo(() => new Set(value), [value]);

  const toggle = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange([...next]);
  };

  if (!provinceCode) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Chọn tỉnh / thành phố trước để hiện danh sách xã, phường.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Tìm xã, phường (gõ không dấu cũng được)"
            className="pl-9"
            disabled={disabled}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || shown.length === 0}
          onClick={() => onChange([...new Set([...value, ...shown.map((u) => u.code)])])}
        >
          Chọn tất cả ({shown.length})
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || value.length === 0}
          onClick={() => onChange([])}
        >
          Bỏ chọn
        </Button>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-2xl border border-border">
        {isLoading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : shown.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Không có đơn vị nào khớp.</p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((u) => {
              const on = selected.has(u.code);
              return (
                <li key={u.code}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(u.code)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                      on ? "bg-primary/10" : "hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                        on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    <span className="flex-1 truncate">{u.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {ADMIN_UNIT_TYPE_LABELS[u.unit_type] ?? u.unit_type} · {u.code}
                    </span>
                    {existing?.has(u.code) && (
                      <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-xs text-foreground">
                        đã có
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Đã chọn <span className="font-semibold text-foreground">{value.length}</span> đơn vị.
      </p>
    </div>
  );
}
