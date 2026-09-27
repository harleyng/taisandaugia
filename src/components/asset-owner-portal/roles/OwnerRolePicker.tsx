import { useId } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { OwnerWsRoleRow } from "@/types/ownerRbac";

interface Props {
  value: string | null;
  onChange: (roleId: string) => void;
  roles: OwnerWsRoleRow[];
  /** Lý do KHÔNG chọn được một vai trò (vd. vượt quyền người chọn); null = chọn được. */
  lockedReason?: (role: OwnerWsRoleRow) => string | null;
}

/**
 * Chọn MỘT vai trò của Trạm, kèm mô tả — người mời hiểu ngay mình đang trao gì.
 * Vai trò do từng Trạm tự định nghĩa ở /chu-tai-san/vai-tro.
 */
export function OwnerRolePicker({ value, onChange, roles, lockedReason }: Props) {
  const idPrefix = useId();

  return (
    <RadioGroup
      value={value ?? ""}
      onValueChange={(v) => {
        // Radix bắn "" khi danh sách đổi — bỏ qua (common-pitfalls).
        if (v) onChange(v);
      }}
      className="max-h-[320px] gap-2 overflow-y-auto pr-1"
    >
      {roles.map((role) => {
        const locked = lockedReason?.(role) ?? null;
        const id = `${idPrefix}-${role.id}`;
        return (
          <Label
            key={role.id}
            htmlFor={id}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3 font-normal transition-colors",
              locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
              value === role.id ? "border-primary bg-primary/5" : !locked && "hover:bg-muted/40",
            )}
          >
            <RadioGroupItem id={id} value={role.id} disabled={!!locked} className="mt-0.5" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{role.name}</span>
              <span className="block text-xs text-muted-foreground">
                {locked ??
                  (role.description ||
                    (role.isSystem ? "Toàn quyền trong đơn vị." : `${role.permissionCount} quyền`))}
              </span>
            </span>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
