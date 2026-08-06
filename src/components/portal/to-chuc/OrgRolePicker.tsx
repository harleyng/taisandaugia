import { Check, Lock } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { OrgRoleWithMeta } from "@/types/orgRbac";

/** Từ số vai trò này trở lên mới hiện ô tìm kiếm — ít hơn thì thừa. */
const SEARCH_THRESHOLD = 6;

interface Props {
  roles: OrgRoleWithMeta[];
  value: string;
  onChange: (roleId: string) => void;
  /** Chỉ Chủ sở hữu mới được trao vai trò Chủ sở hữu (khớp WITH CHECK của RLS). */
  isOwner: boolean;
  disabled?: boolean;
}

/**
 * Chọn MỘT vai trò trong tổ chức. Dùng chung cho dialog mời và dialog đổi vai trò.
 *
 * Tổ chức tự tạo vai trò không giới hạn, nên danh sách phẳng dạng radio sẽ kéo
 * dài dialog vô tận. Ở đây dùng Command inline: có tìm kiếm (chỉ hiện khi danh
 * sách đủ dài), vùng cuộn cao cố định, vẫn giữ mô tả từng vai trò để người dùng
 * chọn đúng thay vì đoán theo tên.
 */
export function OrgRolePicker({ roles, value, onChange, isOwner, disabled }: Props) {
  const searchable = roles.length >= SEARCH_THRESHOLD;

  return (
    <Command
      className="rounded-lg border border-border"
      // Cho tìm theo cả mô tả, không chỉ tên vai trò.
      filter={(itemValue, search) =>
        itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
      }
    >
      {searchable && <CommandInput placeholder="Tìm vai trò…" />}
      <CommandList className="max-h-[240px]">
        <CommandEmpty>Không tìm thấy vai trò phù hợp.</CommandEmpty>
        <CommandGroup>
          {roles.map((r) => {
            const ownerLocked = r.code === "OWNER" && !isOwner;
            const selected = value === r.id;
            return (
              <CommandItem
                key={r.id}
                value={`${r.name} ${r.code} ${r.description ?? ""}`}
                disabled={disabled || ownerLocked}
                onSelect={() => !ownerLocked && !disabled && onChange(r.id)}
                className={cn(
                  "items-start gap-2.5 py-2",
                  ownerLocked && "opacity-60",
                  selected && "bg-primary/5",
                )}
              >
                {ownerLocked ? (
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <Check
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      selected ? "opacity-100 text-primary" : "opacity-0",
                    )}
                  />
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{r.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {ownerLocked
                      ? "Chỉ Chủ sở hữu mới có thể trao vai trò này"
                      : r.description || "—"}
                  </span>
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
