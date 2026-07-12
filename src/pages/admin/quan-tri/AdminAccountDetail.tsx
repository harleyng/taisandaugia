import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminAccount, useRevokeAdmin } from "@/hooks/useAdminAccounts";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { AccountRolesCard } from "@/components/admin/quan-tri/AccountRolesCard";
import { AddAccountRolesDialog } from "@/components/admin/quan-tri/AddAccountRolesDialog";

const initialsOf = (name: string | null, email: string) => {
  const base = (name || email).trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
};
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");

export default function AdminAccountDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const { data, isLoading } = useAdminAccount(id);
  const canManage = useHasAdminPermission("tai-khoan", "update");
  const canRevoke = useHasAdminPermission("tai-khoan", "delete");
  const revoke = useRevokeAdmin();
  const [addOpen, setAddOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const { account, assignments } = data;
  const isSelf = account.userId === userId;

  const runRevoke = async () => {
    try {
      await revoke.mutateAsync(account.userId);
      toast.success("Đã thu hồi quyền quản trị");
      navigate("/admin/quan-tri/tai-khoan");
    } catch (err) {
      toast.error("Thu hồi thất bại", { description: (err as Error).message });
      setRevokeOpen(false);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <button
        onClick={() => navigate("/admin/quan-tri/tai-khoan")}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Danh sách tài khoản
      </button>

      {/* Hero header */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border border-border">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
                {initialsOf(account.name, account.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                {account.lockStatus === "locked" ? (
                  <Badge variant="destructive">Bị khóa</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-success/10 text-success">Hoạt động</Badge>
                )}
                {account.isSuperAdmin && (
                  <Badge className="gap-1"><ShieldCheck className="h-3 w-3" />Quản trị tối cao</Badge>
                )}
              </div>
              <h1 className="truncate text-xl font-semibold text-foreground">{account.name || "—"}</h1>
              <p className="text-sm text-muted-foreground">{account.email}</p>
              <p className="text-xs text-muted-foreground">Tạo ngày {fmtDate(account.created_at)}</p>
            </div>
          </div>

          {canRevoke && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setRevokeOpen(true)}
              disabled={isSelf}
              title={isSelf ? "Không thể tự thu hồi quyền của chính mình" : undefined}
            >
              <ShieldOff className="h-4 w-4 mr-1.5" />Thu hồi quyền
            </Button>
          )}
        </div>

        {account.isSuperAdmin && (
          <p className="mt-4 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Tài khoản có vai trò <strong className="text-foreground">Quản trị tối cao</strong> — toàn quyền mọi khu vực, không phụ thuộc các vai trò khác.
          </p>
        )}
      </div>

      {/* Phân quyền — tất cả trên 1 màn, không chia tab */}
      <AccountRolesCard
        userId={account.userId}
        assignments={assignments}
        canManage={canManage}
        onAdd={() => setAddOpen(true)}
      />

      <AddAccountRolesDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        userId={account.userId}
        currentRoleIds={assignments.map((a) => a.role.id)}
      />

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thu hồi quyền quản trị?</AlertDialogTitle>
            <AlertDialogDescription>
              “{account.email}” sẽ mất mọi vai trò quản trị và trở thành người dùng thường. Tài khoản đăng nhập vẫn tồn tại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                runRevoke();
              }}
            >
              {revoke.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Thu hồi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
