import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateUser } from "@/hooks/useAdminUsers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function CreateUserDialog({ open, onOpenChange }: Props) {
  const create = useCreateUser();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setName("");
      setMakeAdmin(false);
    }
  }, [open]);

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!isEmail(e)) return toast.error("Vui lòng nhập email hợp lệ");
    try {
      await create.mutateAsync({ email: e, name: name.trim(), makeAdmin });
      toast.success("Đã tạo người dùng", {
        description: "Email kích hoạt & đặt mật khẩu đã được gửi tới người dùng.",
      });
      onOpenChange(false);
    } catch (err) {
      toast.error("Tạo người dùng thất bại", { description: (err as Error).message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tạo người dùng mới</DialogTitle>
          <DialogDescription>
            Tài khoản được kích hoạt sẵn. Hệ thống gửi email để người dùng đặt mật khẩu và đăng nhập.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Email <span className="text-destructive">*</span></Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Họ tên</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
          </div>
          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <Checkbox checked={makeAdmin} onCheckedChange={(c) => setMakeAdmin(c === true)} />
            <span className="text-sm text-foreground">Cấp quyền Admin</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Tạo & gửi email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
