import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useServiceCatalog } from "@/hooks/useServiceCatalog";
import {
  SUB_FEATURE_LABELS,
  SUB_FEATURE_UNITS,
  SUPPORTED_SUB_VARIANTS,
} from "@/lib/ownerSubscription/status";
import type { EntitlementInput, SubVariantKey } from "@/lib/ownerSubscription/types";

interface Props {
  value: EntitlementInput[];
  onChange: (next: EntitlementInput[]) => void;
  disabled?: boolean;
}

/**
 * Danh sách tính năng trong gói + hạn mức mỗi tháng. Tính năng KHÔNG chọn ⇒ thành viên
 * vẫn trả credit như cũ (không bị chặn). Giá credit hiện hành chỉ để tham khảo.
 */
export function EntitlementLinesEditor({ value, onChange, disabled }: Props) {
  const { costOf } = useServiceCatalog();
  const byKey = new Map(value.map((l) => [l.variant_key, l]));

  const update = (key: SubVariantKey, line: EntitlementInput | null) => {
    const rest = value.filter((l) => l.variant_key !== key);
    const next = line ? [...rest, line] : rest;
    next.sort((a, b) => SUPPORTED_SUB_VARIANTS.indexOf(a.variant_key) - SUPPORTED_SUB_VARIANTS.indexOf(b.variant_key));
    onChange(next);
  };

  return (
    <div className="divide-y rounded-xl border">
      {SUPPORTED_SUB_VARIANTS.map((key) => {
        const line = byKey.get(key);
        const included = !!line;
        const unlimited = included && line.monthly_quota === null;
        const cost = costOf(key);
        return (
          <div key={key} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
            <label className="flex min-w-[220px] flex-1 items-center gap-2.5">
              <Checkbox
                checked={included}
                disabled={disabled}
                onCheckedChange={(c) => update(key, c ? { variant_key: key, monthly_quota: 10 } : null)}
              />
              <span>
                <span className="block text-sm font-medium text-foreground">{SUB_FEATURE_LABELS[key]}</span>
                <span className="block text-xs text-muted-foreground">
                  Giá lẻ ngoài gói: {cost} credit / lượt
                </span>
              </span>
            </label>
            {included && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={1}
                    aria-label={`Hạn mức ${SUB_FEATURE_LABELS[key]} mỗi tháng`}
                    className="h-9 w-24 tabular-nums"
                    disabled={disabled || unlimited}
                    value={unlimited ? "" : String(line.monthly_quota ?? "")}
                    placeholder="∞"
                    onChange={(e) => {
                      const n = Math.floor(Number(e.target.value));
                      update(key, { variant_key: key, monthly_quota: Number.isFinite(n) && n > 0 ? n : 1 });
                    }}
                  />
                  <span className="text-xs text-muted-foreground">{SUB_FEATURE_UNITS[key]} / tháng</span>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    checked={unlimited}
                    disabled={disabled}
                    onCheckedChange={(c) => update(key, { variant_key: key, monthly_quota: c ? null : 10 })}
                  />
                  Không giới hạn
                </label>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
