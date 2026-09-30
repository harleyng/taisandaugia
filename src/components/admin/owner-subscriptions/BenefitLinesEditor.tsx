import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlanBenefit } from "@/lib/ownerSubscription/types";

interface Props {
  value: PlanBenefit[];
  onChange: (next: PlanBenefit[]) => void;
  disabled?: boolean;
}

const MAX_LINES = 30;

/**
 * Dòng quyền lợi hiển thị trên thẻ gói + bảng so sánh (nhóm · nội dung · giá trị). Hệ thống
 * KHÔNG kiểm các dòng này — chỉ ghi điều sàn thực sự cam kết.
 */
export function BenefitLinesEditor({ value, onChange, disabled }: Props) {
  const set = (i: number, patch: Partial<PlanBenefit>) =>
    onChange(value.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="hidden grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-2 px-1 text-xs text-muted-foreground sm:grid">
          <span>Nhóm</span>
          <span>Quyền lợi</span>
          <span>Giá trị</span>
          <span className="w-[104px]" />
        </div>
      )}
      {value.map((b, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto]">
          <Input
            aria-label="Nhóm"
            placeholder="Tài sản"
            value={b.group}
            maxLength={40}
            disabled={disabled}
            onChange={(e) => set(i, { group: e.target.value })}
          />
          <Input
            aria-label="Quyền lợi"
            placeholder="Số hoá hồ sơ"
            value={b.label}
            maxLength={80}
            disabled={disabled}
            onChange={(e) => set(i, { label: e.target.value })}
          />
          <Input
            aria-label="Giá trị"
            placeholder="50 hồ sơ / tháng"
            value={b.value}
            maxLength={60}
            disabled={disabled}
            onChange={(e) => set(i, { value: e.target.value })}
          />
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
              aria-label="Xoá dòng"
              className="text-destructive hover:text-destructive"
              disabled={disabled}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || value.length >= MAX_LINES}
        onClick={() => onChange([...value, { group: value[value.length - 1]?.group ?? "", label: "", value: "" }])}
      >
        <Plus className="mr-1.5 h-4 w-4" /> Thêm dòng quyền lợi
      </Button>
      <p className="text-xs text-muted-foreground">
        Chỉ để hiển thị — hệ thống không kiểm. Ghi "Không giới hạn" hoặc bắt đầu bằng số ("1,000 thư / tháng") để bảng so sánh tô được ô nâng hạng.
      </p>
    </div>
  );
}
