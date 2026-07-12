import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminUsers, useAdminUserStats } from "@/hooks/useAdminUsers";
import { accountStatus, type AccountStatus } from "@/types/adminUser";
import { UserStats } from "@/components/admin/users/UserStats";
import { UserTable } from "@/components/admin/users/UserTable";
import { CreateUserDialog } from "@/components/admin/users/CreateUserDialog";

type StatusFilter = "all" | AccountStatus;
type RoleFilter = "all" | "admin" | "user";
type Sort = "newest" | "oldest" | "balance";

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const { data: users, isLoading } = useAdminUsers();
  const { data: stats, isLoading: statsLoading } = useAdminUserStats();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [role, setRole] = useState<RoleFilter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = (users ?? []).filter((u) => {
      if (q && !u.email.toLowerCase().includes(q) && !(u.name ?? "").toLowerCase().includes(q)) return false;
      if (status !== "all" && accountStatus(u) !== status) return false;
      if (role === "admin" && !u.isAdmin) return false;
      if (role === "user" && u.isAdmin) return false;
      return true;
    });
    rows = [...rows].sort((a, b) => {
      if (sort === "balance") return b.balance - a.balance;
      const cmp = a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
      return sort === "oldest" ? cmp : -cmp;
    });
    return rows;
  }, [users, search, status, role, sort]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Quản lý người dùng</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tra cứu, khóa/mở, tặng credit và đặt lại mật khẩu người dùng.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Tạo người dùng
        </Button>
      </div>

      <UserStats stats={stats} isLoading={statsLoading} />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Tìm email / tên…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi trạng thái</SelectItem>
            <SelectItem value="active">Hoạt động</SelectItem>
            <SelectItem value="not_activated">Chưa kích hoạt</SelectItem>
            <SelectItem value="locked">Bị khóa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={(v) => setRole(v as RoleFilter)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi vai trò</SelectItem>
            <SelectItem value="user">Người dùng</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Mới đăng ký</SelectItem>
            <SelectItem value="oldest">Cũ nhất</SelectItem>
            <SelectItem value="balance">Số dư cao</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <UserTable users={filtered} isLoading={isLoading} onView={(u) => navigate(`/admin/nguoi-dung/${u.id}`)} />

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
