import { useState } from "react";
import { Check, Copy, MoreHorizontal, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  inviteLink,
  inviteErrorMessage,
  useRevokeOrgInvite,
  useRotateOrgInvite,
} from "@/hooks/useOrgInvites";
import type { OrgMemberRow } from "@/types/orgRbac";

interface Props {
  rows: OrgMemberRow[];
  isLoading: boolean;
  error?: unknown;
  orgId: string;
  currentUserId: string | null;
  canUpdate: boolean;
  canDelete: boolean;
  canInvite: boolean;
  isOwner: boolean;
  onChangeRole: (m: OrgMemberRow) => void;
  onRemove: (m: OrgMemberRow) => void;
}

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

/** MỘT bảng cho cả thành viên lẫn lời mời — cột Trạng thái là thứ phân biệt. */
export function MembersTable({
  rows,
  isLoading,
  error,
  orgId,
  currentUserId,
  canUpdate,
  canDelete,
  canInvite,
  isOwner,
  onChangeRole,
  onRemove,
}: Props) {
  const rotate = useRotateOrgInvite();
  const revoke = useRevokeOrgInvite();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copy = async (row: OrgMemberRow) => {
    if (!row.token) return;
    try {
      await navigator.clipboard.writeText(inviteLink(row.token));
      setCopiedId(row.membershipId);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success("Đã sao chép liên kết");
    } catch {
      toast.error("Không sao chép được, vui lòng thử lại");
    }
  };

  const doRotate = async (row: OrgMemberRow) => {
    try {
      const res = await rotate.mutateAsync({ membershipId: row.membershipId, orgId });
      await navigator.clipboard.writeText(inviteLink(res.token)).catch((): void => undefined);
      toast.success("Đã tạo liên kết mới", {
        description: "Liên kết cũ không dùng được nữa.",
      });
    } catch (err) {
      toast.error("Không tạo được liên kết mới", { description: inviteErrorMessage(err) });
    }
  };

  const doRevoke = async (row: OrgMemberRow) => {
    try {
      await revoke.mutateAsync({ membershipId: row.membershipId, orgId });
      toast.success("Đã thu hồi lời mời");
    } catch (err) {
      toast.error("Thu hồi thất bại", { description: inviteErrorMessage(err) });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  // Hiện lỗi thay vì bảng rỗng: query hỏng mà render "chưa có thành viên" là
  // báo sai sự thật (đúng cái đã xảy ra với embed profiles nhập nhằng).
  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-6 py-8 text-center">
        <p className="text-sm font-medium text-foreground">
          Không tải được danh sách thành viên
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {(error as { message?: string })?.message ?? "Vui lòng thử lại."}
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          Chưa có thành viên nào. Dùng nút “Mời thành viên” để bắt đầu.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Thành viên</th>
            <th className="px-4 py-3 font-medium">Vai trò</th>
            <th className="px-4 py-3 font-medium">Trạng thái</th>
            <th className="px-4 py-3 font-medium whitespace-nowrap">Tham gia / Hết hạn</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((m) => {
            const isInvite = m.kind === "INVITE";
            const isSelf = !!m.userId && m.userId === currentUserId;
            const targetIsOwner = m.roleCode === "OWNER";
            // Chỉ Chủ sở hữu mới đụng được dòng của Chủ sở hữu (khớp RLS).
            const mayEdit = !isInvite && canUpdate && (!targetIsOwner || isOwner);
            const mayRemove = !isInvite && canDelete && !isSelf && (!targetIsOwner || isOwner);
            const mayManageInvite = isInvite && (canInvite || canDelete);

            return (
              <tr key={m.membershipId} className="transition-colors hover:bg-muted/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {m.name || m.email || "—"}
                    </span>
                    {isSelf && (
                      <Badge variant="secondary" className="text-[10px]">
                        Bạn
                      </Badge>
                    )}
                  </div>
                  {m.name && m.email && (
                    <span className="text-xs text-muted-foreground">{m.email}</span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    {targetIsOwner && <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                    {m.roleName}
                  </span>
                </td>

                <td className="px-4 py-3">
                  {!isInvite ? (
                    <Badge variant="secondary" className="gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      Đang hoạt động
                    </Badge>
                  ) : m.isExpired ? (
                    <Badge variant="destructive">Lời mời hết hạn</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1.5 text-warning">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                      Đang mời
                    </Badge>
                  )}
                </td>

                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {isInvite ? fmtDate(m.expiresAt) : fmtDate(m.joinedAt)}
                </td>

                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {isInvite && m.token && !m.isExpired && (
                      <button
                        onClick={() => copy(m)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                        title="Sao chép liên kết mời"
                      >
                        {copiedId === m.membershipId ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    {(mayEdit || mayRemove || mayManageInvite) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                            aria-label="Thao tác"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {mayEdit && (
                            <DropdownMenuItem onClick={() => onChangeRole(m)}>
                              Đổi vai trò
                            </DropdownMenuItem>
                          )}
                          {mayRemove && (
                            <DropdownMenuItem
                              onClick={() => onRemove(m)}
                              className="text-destructive focus:text-destructive"
                            >
                              Gỡ khỏi tổ chức
                            </DropdownMenuItem>
                          )}
                          {mayManageInvite && (
                            <>
                              <DropdownMenuItem onClick={() => doRotate(m)}>
                                Tạo liên kết mới
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => doRevoke(m)}
                                className="text-destructive focus:text-destructive"
                              >
                                Thu hồi lời mời
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
