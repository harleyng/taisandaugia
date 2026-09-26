import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { WorkspaceBranchOption } from "@/hooks/useOwnerWorkspaceMembers";

interface Props {
  branches: WorkspaceBranchOption[];
  /** NULL = toàn bộ chi nhánh; mảng = chỉ các chi nhánh được chọn (có thể rỗng khi đang chọn dở). */
  value: string[] | null;
  onChange: (value: string[] | null) => void;
  error?: string;
}

/** Phạm vi của Cán bộ: toàn bộ hay chỉ một số chi nhánh. */
export function BranchScopePicker({ branches, value, onChange, error }: Props) {
  const idPrefix = useId();

  if (branches.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Không gian chưa có chi nhánh — Cán bộ sẽ làm việc trên toàn bộ không gian.
      </p>
    );
  }

  const scoped = value !== null;
  const selected = new Set(value ?? []);

  const toggle = (branchId: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(branchId);
    else next.delete(branchId);
    onChange([...next]);
  };

  return (
    <div className="space-y-2">
      <RadioGroup
        value={scoped ? "some" : "all"}
        onValueChange={(v) => onChange(v === "all" ? null : [...selected])}
        className="gap-1.5"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem id={`${idPrefix}-all`} value="all" />
          <Label htmlFor={`${idPrefix}-all`} className="font-normal">
            Toàn bộ chi nhánh
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem id={`${idPrefix}-some`} value="some" />
          <Label htmlFor={`${idPrefix}-some`} className="font-normal">
            Chỉ một số chi nhánh
          </Label>
        </div>
      </RadioGroup>

      {scoped && (
        <div className="max-h-48 divide-y overflow-y-auto rounded-xl border">
          {branches.map((b) => (
            <label
              key={b.id}
              className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/40"
            >
              <Checkbox checked={selected.has(b.id)} onCheckedChange={(c) => toggle(b.id, c === true)} />
              <span className="min-w-0 flex-1 truncate text-foreground">{b.label}</span>
              {!b.isActive && <span className="shrink-0 text-xs text-muted-foreground">Đã tắt</span>}
            </label>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
