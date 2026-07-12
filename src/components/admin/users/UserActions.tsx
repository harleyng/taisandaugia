import { useState } from "react";
import { Lock, Unlock, KeyRound, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useSetActivated, useSetLock, useResetPassword } from "@/hooks/useAdminUsers";
import type { AdminUser } from "@/types/adminUser";

type Confirm = "activate" | "lock" | "unlock" | "reset" | null;

export function UserActions({ user }: { user: AdminUser }) {
  const setActivated = useSetActivated();
  const setLock = useSetLock();
  const resetPassword = useResetPassword();
  const [confirm, setConfirm] = useState<Confirm>(null);

  const busy = setActivated.isPending || setLock.isPending || resetPassword.isPending;
  const isLocked = user.lockStatus === "locked";

  const run = async () => {
    try {
      if (confirm === "activate") {
        await setActivated.mutateAsync({ userId: user.id, activated: true });
        toast.success("Đã kích hoạt tài khoản");
      } else if (confirm === "lock") {
        await setLock.mutateAsync({ userId: user.id, lock: true });
        toast.success("Đã khóa tài khoản");
      } else if (confirm === "unlock") {
        await setLock.mutateAsync({ userId: user.id, lock: false });
        toast.success("Đã mở khóa tài khoản");
      } else if (confirm === "reset") {
        await resetPassword.mutateAsync(user.email);
        toast.success("Đã gửi email đặt lại mật khẩu");
      }
    } catch (err) {
      toast.error("Thao tác thất bại", { description: (err as Error).message });
    } finally {
      setConfirm(null);
    }
  };

  const COPY: Record<Exclude<Confirm, null>, { title: string; desc: string; action: string; danger?: boolean }> = {
    activate: {
      title: "Kích hoạt tài khoản?",
      desc: `Tài khoản "${user.email}" sẽ được kích hoạt và bỏ qua bước nạp lần đầu.`,
      action: "Kích hoạt",
    },
    lock: {
      title: "Khóa tài khoản?",
      desc: `"${user.email}" sẽ không thể đăng nhập cho đến khi được mở khóa.`,
      action: "Khóa",
      danger: true,
    },
    unlock: {
      title: "Mở khóa tài khoản?",
      desc: `"${user.email}" sẽ có thể đăng nhập trở lại.`,
      action: "Mở khóa",
    },
    reset: {
      title: "Đặt lại mật khẩu?",
      desc: `Gửi email đặt lại mật khẩu đến "${user.email}".`,
      action: "Gửi email",
    },
  };

  return (
    <div className="flex flex-wrap gap-2">
      {!user.activated && (
        <Button variant="outline" size="sm" onClick={() => setConfirm("activate")} disabled={busy}>
          <Zap className="h-4 w-4 mr-1.5" /> Kích hoạt
        </Button>
      )}
      {isLocked ? (
        <Button variant="outline" size="sm" onClick={() => setConfirm("unlock")} disabled={busy}>
          <Unlock className="h-4 w-4 mr-1.5" /> Mở khóa
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirm("lock")}
          disabled={busy}
        >
          <Lock className="h-4 w-4 mr-1.5" /> Khóa tài khoản
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => setConfirm("reset")} disabled={busy}>
        <KeyRound className="h-4 w-4 mr-1.5" /> Đặt lại mật khẩu
      </Button>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          {confirm && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{COPY[confirm].title}</AlertDialogTitle>
                <AlertDialogDescription>{COPY[confirm].desc}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction
                  className={COPY[confirm].danger ? "bg-destructive hover:bg-destructive/90" : ""}
                  onClick={(e) => {
                    e.preventDefault();
                    run();
                  }}
                >
                  {busy && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  {COPY[confirm].action}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
