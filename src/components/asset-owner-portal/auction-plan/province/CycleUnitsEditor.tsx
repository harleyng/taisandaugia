import { useMemo, useState } from "react";
import { GitBranch, Link2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlanNumberInput } from "@/components/asset-owner-portal/auction-plan/editor/PlanNumberInput";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { formatMoneyShort } from "@/utils/money";
import type { PlanCycleCandidate } from "@/hooks/useAuctionPlanProvince";

import { emptyDraft, type CycleUnitDraft, type CycleUnitDraftMap } from "./cycleDraft";

interface CycleUnitsEditorProps {
  candidates: readonly PlanCycleCandidate[];
  draft: CycleUnitDraftMap;
  onChange: (next: CycleUnitDraftMap) => void;
  disabled?: boolean;
}

/**
 * Chọn xã trong đợt + giao chỉ tiêu thu / số tài sản cho từng xã (§A4.1).
 *
 * "Điền nhanh" chia một tổng cho các xã ĐANG CHỌN (phần dư cộng vào xã đầu) —
 * đỡ việc gõ tay 24 dòng; mỗi dòng vẫn sửa lại được.
 *
 * Hai hình triển khai của §A2 nằm trong CÙNG danh sách, phân biệt bằng viên nhỏ:
 * chi nhánh (hình A) và Trạm con đã liên kết (hình B).
 */
export function CycleUnitsEditor({ candidates, draft, onChange, disabled }: CycleUnitsEditorProps) {
  const [bulkRevenue, setBulkRevenue] = useState<number | null>(null);
  const [bulkCount, setBulkCount] = useState<number | null>(null);

  const selected = useMemo(
    () => candidates.filter((c) => draft[c.admin_unit_code]?.selected),
    [candidates, draft],
  );
  const totalRevenue = selected.reduce((t, c) => t + (draft[c.admin_unit_code]?.revenue ?? 0), 0);
  const totalCount = selected.reduce((t, c) => t + (draft[c.admin_unit_code]?.count ?? 0), 0);

  const patch = (code: string, next: Partial<CycleUnitDraft>) =>
    onChange({ ...draft, [code]: { ...(draft[code] ?? emptyDraft), ...next } });

  const toggleAll = (on: boolean) => {
    const next: CycleUnitDraftMap = { ...draft };
    for (const c of candidates) {
      next[c.admin_unit_code] = { ...(next[c.admin_unit_code] ?? emptyDraft), selected: on };
    }
    onChange(next);
  };

  const spread = () => {
    if (selected.length === 0) return;
    const next: CycleUnitDraftMap = { ...draft };
    const share = (total: number | null) => (total === null ? null : Math.floor(total / selected.length));
    const rev = share(bulkRevenue);
    const cnt = share(bulkCount);
    selected.forEach((c, i) => {
      const extraRev = rev !== null && i === 0 ? (bulkRevenue ?? 0) - rev * selected.length : 0;
      const extraCnt = cnt !== null && i === 0 ? (bulkCount ?? 0) - cnt * selected.length : 0;
      next[c.admin_unit_code] = {
        ...(next[c.admin_unit_code] ?? emptyDraft),
        selected: true,
        revenue: rev === null ? next[c.admin_unit_code]?.revenue ?? null : rev + extraRev,
        count: cnt === null ? next[c.admin_unit_code]?.count ?? null : cnt + extraCnt,
      };
    });
    onChange(next);
  };

  if (candidates.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        compact
        title="Chưa có đơn vị cấp xã nào."
        description="Chi nhánh phải được gắn mã xã / phường ở Chi nhánh · AMC, hoặc Trạm của xã phải được liên kết làm Trạm con."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-muted/40 p-3">
        <div className="space-y-1">
          <Label htmlFor="cycle-bulk-revenue" className="text-xs">
            Tổng chỉ tiêu thu giao (₫)
          </Label>
          <PlanNumberInput
            id="cycle-bulk-revenue"
            value={bulkRevenue}
            onChange={setBulkRevenue}
            disabled={disabled}
            placeholder="0"
          />
        </div>
        <div className="w-32 space-y-1">
          <Label htmlFor="cycle-bulk-count" className="text-xs">
            Tổng số tài sản
          </Label>
          <PlanNumberInput
            id="cycle-bulk-count"
            value={bulkCount}
            onChange={setBulkCount}
            disabled={disabled}
            placeholder="0"
          />
        </div>
        <Button type="button" variant="outline" onClick={spread} disabled={disabled || selected.length === 0}>
          <Wand2 aria-hidden="true" />
          Chia đều cho {selected.length} đơn vị
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => toggleAll(true)}>
            Chọn tất cả
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => toggleAll(false)}>
            Bỏ chọn
          </Button>
        </div>
        <span>
          Đang chọn {selected.length}/{candidates.length} đơn vị · {totalCount} tài sản ·{" "}
          {formatMoneyShort(totalRevenue)}
        </span>
      </div>

      <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
        {candidates.map((c) => {
          const row = draft[c.admin_unit_code] ?? emptyDraft;
          return (
            <div
              key={c.admin_unit_code}
              className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center"
            >
              <label className="flex min-w-0 flex-1 items-center gap-2.5">
                <Checkbox
                  checked={row.selected}
                  disabled={disabled}
                  onCheckedChange={(v) => patch(c.admin_unit_code, { selected: v === true })}
                  aria-label={`Đưa ${c.unit_name} vào đợt`}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{c.unit_name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {c.shape === "branch" ? (
                      <GitBranch className="size-3" strokeWidth={1.5} aria-hidden="true" />
                    ) : (
                      <Link2 className="size-3" strokeWidth={1.5} aria-hidden="true" />
                    )}
                    {c.shape === "branch" ? "Chi nhánh" : "Trạm con đã liên kết"} · {c.admin_unit_code}
                  </span>
                </span>
              </label>
              <div className="flex shrink-0 items-end gap-2">
                <div className="w-44 space-y-1">
                  <Label htmlFor={`rev-${c.admin_unit_code}`} className="text-[11px] text-muted-foreground">
                    Chỉ tiêu thu (₫)
                  </Label>
                  <PlanNumberInput
                    id={`rev-${c.admin_unit_code}`}
                    value={row.revenue}
                    onChange={(v) => patch(c.admin_unit_code, { revenue: v })}
                    disabled={disabled || !row.selected}
                  />
                </div>
                <div className="w-24 space-y-1">
                  <Label htmlFor={`cnt-${c.admin_unit_code}`} className="text-[11px] text-muted-foreground">
                    Số tài sản
                  </Label>
                  <Input
                    id={`cnt-${c.admin_unit_code}`}
                    inputMode="numeric"
                    className="tabular-nums"
                    value={row.count === null ? "" : String(row.count)}
                    disabled={disabled || !row.selected}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^\d]/g, "");
                      patch(c.admin_unit_code, { count: cleaned ? Number(cleaned) : null });
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
