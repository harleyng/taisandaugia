import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminAccounts } from "@/hooks/useAdminAccounts";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { AccountsTable } from "@/components/admin/quan-tri/AccountsTable";
import { CreateAdminDialog } from "@/components/admin/quan-tri/CreateAdminDialog";

export default function AdminAccountsPage() {
  const navigate = useNavigate();
  const { data: accounts, isLoading } = useAdminAccounts();
  const canCreate = useHasAdminPermission("tai-khoan", "create");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts ?? [];
    return (accounts ?? []).filter(
      (a) => a.email.toLowerCase().includes(q) || (a.name ?? "").toLowerCase().includes(q),
    );
  }, [accounts, search]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Tài khoản quản trị</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tạo, phân quyền và thu hồi quyền các tài khoản quản trị.
          </p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Thêm admin
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm email / tên…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <AccountsTable
        accounts={filtered}
        isLoading={isLoading}
        onView={(a) => navigate(`/admin/quan-tri/tai-khoan/${a.userId}`)}
      />

      <CreateAdminDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
