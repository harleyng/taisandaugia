import { Checkbox } from "@/components/ui/checkbox";

interface RoleLite {
  id: string;
  name: string;
  code: string;
  description?: string | null;
}

interface Props {
  roles: RoleLite[];
  value: string[];
  onChange: (ids: string[]) => void;
  emptyText?: string;
}

// Danh sách checkbox chọn vai trò — dùng chung cho gán quyền & tạo admin.
export function RoleCheckList({ roles, value, onChange, emptyText }: Props) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  if (roles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        {emptyText ?? "Chưa có vai trò nào. Hãy tạo vai trò trước."}
      </p>
    );
  }

  return (
    <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
      {roles.map((r) => (
        <label key={r.id} className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-muted/40">
          <Checkbox checked={value.includes(r.id)} onCheckedChange={() => toggle(r.id)} className="mt-0.5" />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">{r.name}</span>
            <span className="block text-xs text-muted-foreground font-mono">{r.code}</span>
          </span>
        </label>
      ))}
    </div>
  );
}
