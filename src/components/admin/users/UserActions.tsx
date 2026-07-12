import { useState } from "react";
import { Lock, Unlock, KeyRound, Zap, Loader2, RefreshCw, Copy, Check } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSetActivated, useSetLock, useSetUserPassword } from "@/hooks/useAdminUsers";
import { randomPassword } from "@/lib/randomPassword";
import type { AdminUser } from "@/types/adminUser";

type Confirm = "activate" | "lock" | "unlock" | null;

export function UserActions({ user }: { user: AdminUser }) {
  const setActivated = useSetActivated();
  const setLock = useSetLock();
  const setPassword = useSetUserPassword();
  const [confirm, setConfirm] = useState<Confirm>(null);

  // Reset-password popup state
  const [resetOpen, setResetOpen] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [copied, setCopied] = useState(false);

  const busy = setActivated.isPending || setLock.isPending;
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
      }
    } catch (err) {
      toast.error("Thao tác thất bại", { description: (err as Error).message });
    } finally {
      setConfirm(null);
    }
  };

  const openReset = () => {
    setNewPass(randomPassword());
    setCopied(false);
    setResetOpen(true);
  };

  const copyPass = async () => {
    try {
      await navigator.clipboard.writeText(newPass);
      setCopied(true);
      toast.success("Đã sao chép mật khẩu");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Không sao chép được, hãy copy thủ công");
    }
  };

  const submitReset = async () => {
    if (newPass.length < 6) return toast.error("Mật khẩu phải có ít nhất 6 ký tự");
    try {
      await setPassword.mutateAsync({ userId: user.id, password: newPass });
      toast.success("Đã đặt lại mật khẩu", {
        description: `Gửi mật khẩu mới cho ${user.email}.`,
      });
      setResetOpen(false);
    } catch (err) {
      toast.error("Đặt lại mật khẩu thất bại", { description: (err as Error).message });
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
      <Button variant="outline" size="sm" onClick={openReset} disabled={busy || setPassword.isPending}>
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

      <Dialog open={resetOpen} onOpenChange={(o) => !setPassword.isPending && setResetOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Đặt lại mật khẩu</DialogTitle>
            <DialogDescription>
              Đặt mật khẩu mới cho <strong className="text-foreground">{user.email}</strong>, rồi gửi cho người dùng. Không có email nào được gửi đi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <Label>Mật khẩu mới</Label>
            <div className="flex gap-2">
              <Input
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="Nhập hoặc tạo ngẫu nhiên"
                autoFocus
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setNewPass(randomPassword())} title="Tạo ngẫu nhiên">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={copyPass} disabled={!newPass} title="Sao chép">
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Tối thiểu 6 ký tự.</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)} disabled={setPassword.isPending}>Hủy</Button>
            <Button onClick={submitReset} disabled={setPassword.isPending || newPass.length < 6}>
              {setPassword.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Đặt lại mật khẩu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
