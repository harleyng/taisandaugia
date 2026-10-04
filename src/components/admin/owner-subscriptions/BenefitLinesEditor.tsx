import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useServiceCatalog } from "@/hooks/useServiceCatalog";
import { BENEFIT_CYCLES, CYCLE_LABELS, benefitLineValid, benefitValueText } from "@/lib/ownerSubscription/benefits";
import { PLAN_CARD_MAX_LINES } from "@/lib/ownerSubscription/catalog";
import type { BenefitCycle, BenefitLineInput, SubBenefitDef } from "@/lib/ownerSubscription/types";

interface Props {
  value: BenefitLineInput[];
  onChange: (next: BenefitLineInput[]) => void;
  /** Danh mục quyền lợi cố định (owner_sub_benefits). */
  catalog: SubBenefitDef[];
  disabled?: boolean;
}

const SOURCE_BADGES: Partial<Record<SubBenefitDef["source"], { text: string; className: string }>> = {
  enforced: { text: "Hệ thống kiểm", className: "bg-primary/10 text-primary" },
  live: { text: "Đếm tự động", className: "bg-muted text-muted-foreground" },
};

/**
 * Quyền lợi trong gói, chọn từ danh mục CỐ ĐỊNH (không có màn sửa danh mục). Mỗi dòng đặt
 * hạn mức + chu kỳ làm mới; thứ tự dòng = thứ tự trên thẻ gói (8 dòng đầu lên thẻ).
 * Chỉ quyền lợi "Hệ thống kiểm" bị chặn / trừ credit khi hết hạn mức — còn lại để hiển thị.
 */
export function BenefitLinesEditor({ value, onChange, catalog, disabled }: Props) {
  const { costOf } = useServiceCatalog();
  const defs = new Map(catalog.map((d) => [d.key, d]));
  const used = new Set(value.map((l) => l.benefit_key));
  const available = catalog.filter((d) => !used.has(d.key));
  const groups = [...new Set(available.map((d) => d.group_name))];

  const set = (i: number, patch: Partial<BenefitLineInput>) =>
    onChange(value.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const add = (key: string) => {
    const def = defs.get(key);
    if (!def) return;
    onChange([...value, { benefit_key: key, quota: 0, cycle: def.kind === "quota" ? def.default_cycle : null }]);
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="divide-y rounded-xl border">
          {value.map((l, i) => {
            const def = defs.get(l.benefit_key);
            if (!def) return null;
            const unlimited = def.kind === "quota" && l.quota === null;
            const badge = SOURCE_BADGES[def.source];
            const ok = benefitLineValid(l, def);
            return (
              <div
                key={l.benefit_key}
                className="grid gap-x-3 gap-y-2 p-3 sm:grid-cols-[1.5rem_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_auto] sm:items-center"
              >
                <span
                  className={cn(
                    "hidden text-xs tabular-nums sm:block",
                    i < PLAN_CARD_MAX_LINES ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">{def.label}</span>
                    {badge && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", badge.className)}>{badge.text}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {def.group_name}
                    {def.source === "enforced" && ` · ngoài hạn mức ${costOf(def.key)} credit / lượt`}
                    {ok && ` · ${benefitValueText({ ...def, quota: l.quota, cycle: l.cycle })}`}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      aria-label={`Hạn mức ${def.label}`}
                      className={cn("h-9 w-24 tabular-nums", !ok && !unlimited && "border-destructive")}
                      disabled={disabled || unlimited}
                      value={unlimited || !l.quota ? "" : String(l.quota)}
                      placeholder={unlimited ? "∞" : ""}
                      onChange={(e) => {
                        const n = Math.floor(Number(e.target.value));
                        set(i, { quota: Number.isFinite(n) && n > 0 ? n : 0 });
                      }}
                    />
                    <span className="text-xs text-muted-foreground">{def.unit}</span>
                  </div>
                  {def.kind === "quota" && (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Checkbox
                        checked={unlimited}
                        disabled={disabled}
                        onCheckedChange={(c) => set(i, { quota: c ? null : 0 })}
                      />
                      Không giới hạn
                    </label>
                  )}
                </div>

                {def.kind === "quota" ? (
                  <Select
                    value={l.cycle ?? undefined}
                    disabled={disabled}
                    onValueChange={(v) => set(i, { cycle: v as BenefitCycle })}
                  >
                    <SelectTrigger className="h-9" aria-label={`Chu kỳ làm mới ${def.label}`}>
                      <SelectValue placeholder="Chu kỳ" />
                    </SelectTrigger>
                    <SelectContent>
                      {BENEFIT_CYCLES.map((c) => (
                        <SelectItem key={c} value={c}>{CYCLE_LABELS[c]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground">Mức cố định — số nhỏ hơn là tốt hơn</span>
                )}

                <div className="flex items-center gap-1">
                  <Button type="button" size="icon" variant="ghost" aria-label="Lên" disabled={disabled || i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" aria-label="Xuống" disabled={disabled || i === value.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Bỏ ${def.label}`}
                    className="text-destructive hover:text-destructive"
                    disabled={disabled}
                    onClick={() => onChange(value.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {available.length > 0 && (
        // Đổi key sau mỗi lần thêm ⇒ ô chọn trở về chữ gợi ý.
        <Select key={value.length} disabled={disabled} onValueChange={add}>
          <SelectTrigger className="h-9 w-full sm:w-72" aria-label="Thêm quyền lợi">
            <SelectValue placeholder="+ Thêm quyền lợi từ danh mục" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((g) => (
              <SelectGroup key={g}>
                <SelectLabel>{g}</SelectLabel>
                {available
                  .filter((d) => d.group_name === g)
                  .map((d) => (
                    <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                  ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      )}
      <p className="text-xs text-muted-foreground">
        Danh mục quyền lợi cố định — cần thêm quyền lợi mới thì liên hệ đội kỹ thuật. Thẻ gói hiện {PLAN_CARD_MAX_LINES} dòng đầu
        (đổi thứ tự bằng ↑ ↓); "Hệ thống kiểm" bị chặn / trừ credit khi hết hạn mức, các dòng khác để hiển thị.
      </p>
    </div>
  );
}
