import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, Check, CircleCheck, Search } from "lucide-react";
import { toast } from "sonner";
import { useAdminRoles } from "@/hooks/useAdminRoles";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { useCreateAdminAccount, usePromoteToAdmin } from "@/hooks/useAdminAccounts";
import { RoleCheckList } from "./RoleCheckList";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
type Result = { email: string; actionLink: string | null };

export function CreateAdminDialog({ open, onOpenChange }: Props) {
  const { data: roles } = useAdminRoles();
  const { data: users } = useAdminUsers();
  const create = useCreateAdminAccount();
  const promote = usePromoteToAdmin();

  const [tab, setTab] = useState<"new" | "promote">("new");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setTab("new");
      setEmail("");
      setName("");
      setRoleIds([]);
      setUserSearch("");
      setSelectedUser(null);
      setResult(null);
      setCopied(false);
    }
  }, [open]);

  const nonAdminUsers = (users ?? []).filter((u) => !u.isAdmin);
  const q = userSearch.trim().toLowerCase();
  const filteredUsers = (q
    ? nonAdminUsers.filter((u) => u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q))
    : nonAdminUsers
  ).slice(0, 20);

  const busy = create.isPending || promote.isPending;

  const submitNew = async () => {
    const e = email.trim().toLowerCase();
    if (!isEmail(e)) return toast.error("Vui lòng nhập email hợp lệ");
    try {
      const res = await create.mutateAsync({ email: e, name: name.trim(), roleIds });
      setResult({ email: res.email, actionLink: res.actionLink });
      toast.success("Đã tạo tài khoản quản trị");
    } catch (err) {
      toast.error("Tạo tài khoản thất bại", { description: (err as Error).message });
    }
  };

  const submitPromote = async () => {
    if (!selectedUser) return toast.error("Chọn một người dùng để cấp quyền");
    try {
      await promote.mutateAsync({ userId: selectedUser, roleIds });
      toast.success("Đã cấp quyền quản trị");
      onOpenChange(false);
    } catch (err) {
      toast.error("Cấp quyền thất bại", { description: (err as Error).message });
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
      toast.error("Không sao chép được, hãy copy thủ công");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CircleCheck className="h-5 w-5 text-success" />
                Đã tạo tài khoản quản trị
              </DialogTitle>
              <DialogDescription>
                Gửi liên kết dưới đây cho <strong className="text-foreground">{result.email}</strong> để họ đặt mật khẩu và đăng nhập.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-1">
              {result.actionLink ? (
                <>
                  <Label>Liên kết đặt mật khẩu</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={result.actionLink} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
                    <Button type="button" variant="outline" size="icon" onClick={copyLink} title="Sao chép">
                      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-warning">
                  Tài khoản đã tạo nhưng không lấy được liên kết. Dùng “Đặt lại mật khẩu” trong Quản lý người dùng.
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
              <DialogTitle>Thêm tài khoản quản trị</DialogTitle>
              <DialogDescription>
                Tạo tài khoản mới hoặc cấp quyền quản trị cho người dùng đã có, rồi gán vai trò.
              </DialogDescription>
            </DialogHeader>

            <Tabs value={tab} onValueChange={(v) => setTab(v as "new" | "promote")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="new">Tạo mới</TabsTrigger>
                <TabsTrigger value="promote">Cấp cho user hiện có</TabsTrigger>
              </TabsList>

              <TabsContent value="new" className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label>Email <span className="text-destructive">*</span></Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
                </div>
                <div className="space-y-1.5">
                  <Label>Họ tên</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
                </div>
              </TabsContent>

              <TabsContent value="promote" className="space-y-3 pt-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Tìm email / tên…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-8" />
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                  {filteredUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Không tìm thấy người dùng phù hợp.</p>
                  ) : (
                    filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setSelectedUser(u.id)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/40 ${selectedUser === u.id ? "bg-primary/10" : ""}`}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground truncate">{u.name || "—"}</span>
                          <span className="block text-xs text-muted-foreground truncate">{u.email}</span>
                        </span>
                        {selectedUser === u.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-1.5">
              <Label>Vai trò</Label>
              <RoleCheckList roles={roles ?? []} value={roleIds} onChange={setRoleIds} />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Hủy</Button>
              {tab === "new" ? (
                <Button onClick={submitNew} disabled={busy}>
                  {create.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  Tạo tài khoản
                </Button>
              ) : (
                <Button onClick={submitPromote} disabled={busy || !selectedUser}>
                  {promote.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  Cấp quyền
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
