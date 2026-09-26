import { useId } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  isOwnerWsRole,
  OWNER_WS_ROLE_DESCRIPTION,
  OWNER_WS_ROLE_LABEL,
  type OwnerWsRole,
} from "@/lib/ownerWorkspace/roles";

interface Props {
  value: OwnerWsRole;
  onChange: (role: OwnerWsRole) => void;
  roles: readonly OwnerWsRole[];
}

/** Chọn vai trò kèm một dòng mô tả quyền — người mời hiểu ngay mình đang trao gì. */
export function OwnerRoleRadio({ value, onChange, roles }: Props) {
  const idPrefix = useId();

  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => {
        if (isOwnerWsRole(v)) onChange(v);
      }}
      className="gap-2"
    >
      {roles.map((role) => (
        <Label
          key={role}
          htmlFor={`${idPrefix}-${role}`}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border p-3 font-normal transition-colors",
            value === role ? "border-primary bg-primary/5" : "hover:bg-muted/40",
          )}
        >
          <RadioGroupItem id={`${idPrefix}-${role}`} value={role} className="mt-0.5" />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">{OWNER_WS_ROLE_LABEL[role]}</span>
            <span className="block text-xs text-muted-foreground">{OWNER_WS_ROLE_DESCRIPTION[role]}</span>
          </span>
        </Label>
      ))}
    </RadioGroup>
  );
}
