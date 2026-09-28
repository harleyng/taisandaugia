import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useSetOwnerSubTermOptions } from "@/hooks/useAdminOwnerSubscriptions";
import type { OwnerSubTermOption } from "@/lib/ownerSubscription/types";

interface Props {
  terms: OwnerSubTermOption[];
  canEdit: boolean;
}

/** Các kỳ Trạm được chọn khi mua gói (3 / 6 / 12 tháng) + chiết khấu từng kỳ. */
export function TermOptionsCard({ terms, canEdit }: Props) {
  const save = useSetOwnerSubTermOptions();
  const [rows, setRows] = useState<OwnerSubTermOption[]>(terms);
  useEffect(() => setRows(terms), [terms]);

  const set = (i: number, patch: Partial<OwnerSubTermOption>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const months = rows.map((r) => r.months);
  const valid =
    rows.length > 0 &&
    new Set(months).size === months.length &&
    rows.every((r) => Number.isInteger(r.months) && r.months >= 1 && r.months <= 36 && r.discount_pct >= 0 && r.discount_pct <= 50) &&
    rows.some((r) => r.is_active);

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Thời hạn &amp; chiết khấu</h2>
        <p className="text-sm text-muted-foreground">
          Giá kỳ = giá tháng × số tháng × (1 − chiết khấu), làm tròn nghìn đồng. Áp dụng cho mọi gói trong danh mục.
        </p>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                max={36}
                aria-label="Số tháng"
                className="h-9 w-20 tabular-nums"
                disabled={!canEdit}
                value={r.months}
                onChange={(e) => set(i, { months: Math.floor(Number(e.target.value)) })}
              />
              <span className="text-sm text-muted-foreground">tháng</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={0}
                max={50}
                step={0.5}
                aria-label="Chiết khấu"
                className="h-9 w-20 tabular-nums"
                disabled={!canEdit}
                value={r.discount_pct}
                onChange={(e) => set(i, { discount_pct: Number(e.target.value) })}
              />
              <span className="text-sm text-muted-foreground">% chiết khấu</span>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={r.is_active} disabled={!canEdit} onCheckedChange={(v) => set(i, { is_active: v })} /> Đang dùng
            </label>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Xoá kỳ"
              className="text-destructive hover:text-destructive"
              disabled={!canEdit}
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      {!valid && <p className="text-xs text-destructive">Mỗi kỳ 1–36 tháng, không trùng; chiết khấu 0–50%; ít nhất một kỳ đang dùng.</p>}
      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRows([...rows, { months: Math.min(36, (months.length ? Math.max(...months) : 0) + 12), discount_pct: 0, is_active: true }])}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Thêm kỳ
          </Button>
          <Button size="sm" disabled={!valid || save.isPending} onClick={() => save.mutate(rows)}>
            {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Lưu thời hạn
          </Button>
        </div>
      )}
    </section>
  );
}
