import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Copy, Check, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { useCreateUser } from "@/hooks/useAdminUsers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

type Result = { email: string; actionLink: string | null };

export function CreateUserDialog({ open, onOpenChange }: Props) {
  const create = useCreateUser();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setName("");
      setMakeAdmin(false);
      setResult(null);
      setCopied(false);
    }
  }, [open]);

  const submit = async () => {
    const e = email.trim().toLowerCase();
    if (!isEmail(e)) return toast.error("Vui lòng nhập email hợp lệ");
    try {
      const res = await create.mutateAsync({ email: e, name: name.trim(), makeAdmin });
      setResult({ email: res.email, actionLink: res.actionLink });
      toast.success("Đã tạo người dùng");
    } catch (err) {
      toast.error("Tạo người dùng thất bại", { description: (err as Error).message });
    }
  };

  const copyLink = async () => {
    if (!result?.actionLink) return;
    try {
      await navigator.clipboard.writeText(result.actionLink);
      setCopied(true);
      toast.success("Đã sao chép liên kết");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Không sao chép được, hãy chọn và copy thủ công");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CircleCheck className="h-5 w-5 text-success" />
                Đã tạo tài khoản
              </DialogTitle>
              <DialogDescription>
                Gửi liên kết dưới đây cho <strong className="text-foreground">{result.email}</strong> để họ tự đặt mật khẩu và đăng nhập.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-1">
              {result.actionLink ? (
                <>
                  <Label>Liên kết đặt mật khẩu</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={result.actionLink}
                      onFocus={(e) => e.currentTarget.select()}
                      className="text-xs"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={copyLink} title="Sao chép">
                      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Liên kết dùng một lần và sẽ hết hạn sau một thời gian. Nếu hết hạn, dùng nút “Đặt lại mật khẩu” trong danh sách.
                  </p>
                </>
              ) : (
                <p className="text-sm text-warning">
                  Tài khoản đã tạo nhưng không lấy được liên kết đặt mật khẩu. Hãy dùng nút “Đặt lại mật khẩu” trong danh sách để cấp mật khẩu cho người dùng.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Xong</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Tạo người dùng mới</DialogTitle>
              <DialogDescription>
                Tài khoản được kích hoạt sẵn. Sau khi tạo, bạn sẽ nhận một liên kết để gửi cho người dùng tự đặt mật khẩu.
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
                Tạo tài khoản
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
