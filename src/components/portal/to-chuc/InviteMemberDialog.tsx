import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useOrgRoles } from "@/hooks/useOrgRoles";
import { useOrgPermissions } from "@/hooks/useOrgPermissions";
import {
  useCheckInviteEmail,
  useCreateOrgInvite,
  inviteErrorMessage,
} from "@/hooks/useOrgInvites";
import { InviteLinkPanel } from "./InviteLinkPanel";
import { OrgRolePicker } from "./OrgRolePicker";
import type { InviteEmailStatus } from "@/types/orgRbac";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgId: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Tone = "ok" | "warn" | "block";

// Quy tắc đã chốt: MỜI ĐƯỢC MỌI EMAIL, chỉ cảnh báo. Chặn duy nhất khi trùng lặp
// (đã là thành viên / đã có lời mời chờ) — hai trường hợp mà tạo thêm là vô nghĩa.
function describe(s: InviteEmailStatus): { tone: Tone; title: string; hint: string } {
  if (s.already_member)
    return { tone: "block", title: "Đã là thành viên", hint: "Người này đã có mặt trong tổ chức." };
  if (s.pending_invite)
    return {
      tone: "block",
      title: "Đã có lời mời đang chờ",
      hint: "Hãy sao chép lại liên kết cũ trong bảng “Đang mời” thay vì tạo lời mời mới.",
    };
  if (s.locked)
    return { tone: "warn", title: "Tài khoản bị khóa", hint: "Họ cần được mở khóa trước khi tham gia được." };
  if (!s.exists)
    return {
      tone: "warn",
      title: "Chưa có tài khoản",
      hint: "Người này cần đăng ký tài khoản rồi kích hoạt mới tham gia được. Bạn vẫn có thể gửi lời mời trước.",
    };
  if (!s.activated)
    return {
      tone: "warn",
      title: "Chưa kích hoạt",
      hint: "Tài khoản cần nạp lần đầu để kích hoạt trước khi tham gia tổ chức.",
    };
  return { tone: "ok", title: "Sẵn sàng", hint: "Tài khoản đã kích hoạt, có thể tham gia ngay." };
}

export function InviteMemberDialog({ open, onOpenChange, orgId }: Props) {
  const { data: roles } = useOrgRoles(orgId);
  const { isOwner } = useOrgPermissions(orgId);
  const check = useCheckInviteEmail();
  const createInvite = useCreateOrgInvite();

  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState<InviteEmailStatus | null>(null);
  const [created, setCreated] = useState<{ token: string; expires_at: string } | null>(null);

  // CHỈ phụ thuộc `open`: để `roles` trong deps thì mỗi lần React Query refetch
  // (vd focus lại cửa sổ) sẽ xóa trắng email đang gõ và lựa chọn vai trò.
  useEffect(() => {
    if (!open) return;
    setEmail("");
    setStatus(null);
    setCreated(null);
    setRoleId("");
  }, [open]);

  // Mặc định chọn vai trò ÍT QUYỀN NHẤT (Nhân viên) chứ không phải "vai trò
  // không-phải-Chủ-sở-hữu đầu tiên" — với tổ chức có nhiều vai trò tự tạo, cái
  // đầu tiên là tùy tiện và dễ vô tình mời với quyền cao hơn cần thiết. Không có
  // AGENT thì để trống, buộc người mời chọn có ý thức (nút Tạo đã chặn sẵn).
  useEffect(() => {
    if (!open || roleId || !roles?.length) return;
    setRoleId(roles.find((r) => r.code === "AGENT")?.id ?? "");
  }, [open, roles, roleId]);

  // Kiểm tra email sau khi người dùng ngừng gõ.
  useEffect(() => {
    if (!open || !EMAIL_RE.test(email)) {
      setStatus(null);
      return;
    }
    const t = setTimeout(() => {
      check.mutate(
        { orgId, email },
        { onSuccess: setStatus, onError: () => setStatus(null) },
      );
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, open, orgId]);

  const info = status ? describe(status) : null;
  const blocked = info?.tone === "block";
  const canSubmit = EMAIL_RE.test(email) && !!roleId && !blocked && !createInvite.isPending;

  const submit = async () => {
    try {
      const res = await createInvite.mutateAsync({ orgId, email, roleId });
      setCreated({ token: res.token, expires_at: res.expires_at });
      toast.success("Đã tạo lời mời");
    } catch (err) {
      toast.error("Tạo lời mời thất bại", { description: inviteErrorMessage(err) });
    }
  };

  // ─── Bước 2: hiện liên kết để copy ───────────────────────────────────────
  if (created) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Đã tạo lời mời
            </DialogTitle>
            <DialogDescription>
              Hệ thống chưa gửi email tự động. Hãy gửi liên kết dưới đây cho{" "}
              <strong className="text-foreground">{email}</strong> để họ tham gia tổ chức.
            </DialogDescription>
          </DialogHeader>

          <div className="py-1">
            <InviteLinkPanel token={created.token} expiresAt={created.expires_at} />
            {status && !status.activated && (
              <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-foreground">
                Lưu ý: tài khoản này chưa kích hoạt. Họ sẽ được yêu cầu kích hoạt trước khi
                vào được tổ chức.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Xong</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Bước 1: nhập email + chọn vai trò ───────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Mời thành viên
          </DialogTitle>
          <DialogDescription>
            Nhập email người bạn muốn mời và chọn vai trò cho họ trong tổ chức.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nguoidung@congty.vn"
              autoFocus
            />
            {check.isPending && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Đang kiểm tra…
              </p>
            )}
            {info && !check.isPending && (
              <div
                className={[
                  "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
                  info.tone === "ok"
                    ? "bg-success/10 text-foreground"
                    : info.tone === "warn"
                      ? "bg-warning/10 text-foreground"
                      : "bg-destructive/10 text-foreground",
                ].join(" ")}
              >
                {info.tone === "ok" ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                ) : (
                  <AlertCircle
                    className={[
                      "mt-0.5 h-3.5 w-3.5 shrink-0",
                      info.tone === "warn" ? "text-warning" : "text-destructive",
                    ].join(" ")}
                  />
                )}
                <span>
                  <strong className="font-medium">{info.title}</strong> — {info.hint}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              Vai trò <span className="text-destructive">*</span>
            </Label>
            <OrgRolePicker
              roles={roles ?? []}
              value={roleId}
              onChange={setRoleId}
              isOwner={isOwner}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {createInvite.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Tạo lời mời
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
