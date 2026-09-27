import { useNavigate } from "react-router-dom";
import { CircleX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WorkspaceBranchOption } from "@/hooks/useOwnerWorkspaceMembers";
import {
  SCOPE_ALL,
  TARGET_PERIOD_LABEL,
  TARGET_PERIOD_TYPES,
  ownerTargetEditHref,
  periodStartOf,
  type TargetPeriodType,
} from "@/lib/ownerTargets";
import { PERIOD_TYPE_SPAN, periodTitle, type TargetSlot } from "@/lib/ownerTargetView";
import { FIELD_LABEL } from "./TargetFormSection";
import { HAIRLINE } from "./targetStyles";

interface TargetPeriodFieldsProps {
  slot: TargetSlot;
  /** Các kỳ chọn được của loại kỳ đang chọn (ngày đầu kỳ). */
  starts: string[];
  today: string;
  branches: WorkspaceBranchOption[];
  /** Chỉ tiêu KHÁC đã chiếm kỳ + phạm vi này (form khoá nút lưu). */
  conflict: { id: string; name: string } | null;
  disabled: boolean;
  onPickType: (type: TargetPeriodType) => void;
  onPickStart: (start: string) => void;
  onPickScope: (scope: string) => void;
}

/** Khối 1 "Kỳ và phạm vi": loại kỳ (3 nút) · kỳ cụ thể · phạm vi · cảnh báo trùng. */
export function TargetPeriodFields({
  slot,
  starts,
  today,
  branches,
  conflict,
  disabled,
  onPickType,
  onPickStart,
  onPickScope,
}: TargetPeriodFieldsProps) {
  const navigate = useNavigate();
  const current = periodStartOf(slot.periodType, today);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className={FIELD_LABEL} id="target-type-label">
          Loại kỳ
        </span>
        <div role="group" aria-labelledby="target-type-label" className="grid gap-2 sm:grid-cols-3">
          {TARGET_PERIOD_TYPES.map((type) => {
            const on = slot.periodType === type;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={on}
                disabled={disabled}
                onClick={() => !on && onPickType(type)}
                className={cn(
                  "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                  on ? "bg-primary/10 shadow-[inset_0_0_0_2px_hsl(var(--primary))]" : cn("bg-card hover:bg-muted", HAIRLINE),
                )}
              >
                <span>
                  <b className="block text-[13.5px] font-[650] text-foreground">{TARGET_PERIOD_LABEL[type]}</b>
                  <small className="text-xs text-muted-foreground">{PERIOD_TYPE_SPAN[type]}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="target-period" className={FIELD_LABEL}>
            Kỳ cụ thể
          </label>
          {/* Radix Select gọi onValueChange("") khi danh sách kỳ đổi (Tháng → Quý) ⇒ bỏ qua giá trị rỗng. */}
          <Select value={slot.periodStart} onValueChange={(v) => v && onPickStart(v)} disabled={disabled}>
            <SelectTrigger id="target-period" className="rounded-lg [&>svg]:shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {starts.map((s) => (
                <SelectItem key={s} value={s}>
                  {periodTitle(slot.periodType, s)}
                  {s === current && " (hiện tại)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="target-scope" className={FIELD_LABEL}>
            Phạm vi
          </label>
          <Select value={slot.scope} onValueChange={(v) => v && onPickScope(v)} disabled={disabled}>
            <SelectTrigger id="target-scope" className="rounded-lg [&>svg]:shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SCOPE_ALL}>Toàn đơn vị</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.isActive ? b.label : `${b.label} · ngừng hoạt động`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {conflict && (
        <div role="alert" className="flex items-start gap-2.5 rounded-[10px] bg-warning/15 px-3 py-2.5 text-[13px] text-foreground">
          <CircleX className="mt-px h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
          <p>
            Đã có chỉ tiêu <b>{conflict.name}</b> cho kỳ và phạm vi này.{" "}
            <button
              type="button"
              className="font-[650] underline underline-offset-2"
              onClick={() => navigate(ownerTargetEditHref(conflict.id))}
            >
              Sửa chỉ tiêu đó
            </button>{" "}
            hoặc chọn kỳ / phạm vi khác.
          </p>
        </div>
      )}
    </>
  );
}
