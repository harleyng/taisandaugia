import { useState } from "react";
import { Plus, Shield, Calendar, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useRemoveAccountRole } from "@/hooks/useAdminAccounts";
import type { AdminRoleAssignment } from "@/types/adminRbac";

interface Props {
  userId: string;
  assignments: AdminRoleAssignment[];
  canManage: boolean;
  onAdd: () => void;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");

export function AccountRolesCard({ userId, assignments, canManage, onAdd }: Props) {
  const remove = useRemoveAccountRole();
  const [target, setTarget] = useState<AdminRoleAssignment | null>(null);

  const runRemove = async () => {
    if (!target) return;
    try {
      await remove.mutateAsync({ assignmentId: target.id, userId });
      toast.success("Đã gỡ vai trò");
    } catch (err) {
      toast.error("Gỡ vai trò thất bại", { description: (err as Error).message });
    } finally {
      setTarget(null);
    }
  };

  if (assignments.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Shield className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-foreground">Chưa gán vai trò nào</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Tài khoản này chưa có vai trò quản trị nào. Gán vai trò để cấp quyền truy cập các khu vực admin.
        </p>
        {canManage && (
          <Button className="mt-5" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-1.5" />Gán vai trò
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground">Vai trò được gán</h3>
          <span className="text-sm text-muted-foreground">({assignments.length})</span>
        </div>
        {canManage && (
          <Button size="sm" onClick={onAdd}>
            <Plus className="h-4 w-4 mr-1.5" />Gán vai trò
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {assignments.map((a) => (
          <div
            key={a.id}
            className="group flex items-center gap-4 rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/30"
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
                a.role.is_system ? "bg-primary/10" : "bg-muted"
              }`}
            >
              <Shield className={`h-5 w-5 ${a.role.is_system ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h4 className="truncate font-medium text-foreground">{a.role.name}</h4>
                <Badge variant="secondary" className={a.role.is_system ? "bg-primary/10 text-primary" : ""}>
                  {a.role.is_system ? "Hệ thống" : "Tùy chỉnh"}
                </Badge>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{a.role.code}</span>
                {a.role.description && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    <span className="truncate">{a.role.description}</span>
                  </>
                )}
              </div>
            </div>
            <div className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
              <Calendar className="h-3 w-3" />
              {fmtDate(a.assigned_at)}
            </div>
            {canManage && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => setTarget(a)}
                title="Gỡ vai trò"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gỡ vai trò “{target?.role.name}”?</AlertDialogTitle>
            <AlertDialogDescription>Tài khoản sẽ mất các quyền do vai trò này cấp.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                runRemove();
              }}
            >
              {remove.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Gỡ vai trò
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
