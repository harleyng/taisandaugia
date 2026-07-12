import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminRoles } from "@/hooks/useAdminRoles";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { RolesTable } from "@/components/admin/quan-tri/RolesTable";
import { RoleFormDialog } from "@/components/admin/quan-tri/RoleFormDialog";

export default function AdminRolesPage() {
  const navigate = useNavigate();
  const { data: roles, isLoading } = useAdminRoles();
  const canCreate = useHasAdminPermission("vai-tro", "create");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles ?? [];
    return (roles ?? []).filter(
      (r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q),
    );
  }, [roles, search]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Vai trò</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tạo vai trò và cấu hình quyền cho từng khu vực quản trị.
          </p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Tạo vai trò
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm tên / mã vai trò…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <RolesTable
        roles={filtered}
        isLoading={isLoading}
        onView={(r) => navigate(`/admin/quan-tri/vai-tro/${r.id}`)}
      />

      <RoleFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(r) => navigate(`/admin/quan-tri/vai-tro/${r.id}`)}
      />
    </div>
  );
}
