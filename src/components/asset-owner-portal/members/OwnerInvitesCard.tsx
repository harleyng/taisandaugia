import { Copy, MailPlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import {
  useCreateOwnerInvite,
  useRevokeOwnerInvite,
  type OwnerWorkspaceInvite,
} from "@/hooks/useOwnerWorkspaceMembers";
import { ownerWsErrorMessage } from "@/lib/ownerWorkspace/errors";
import { ownerInviteLink } from "@/lib/ownerWorkspace/inviteLink";
import { OWNER_WS_ROLE_LABEL } from "@/lib/ownerWorkspace/roles";
import { scopeLabel } from "./scopeLabel";

interface Props {
  workspaceId: string;
  invites: OwnerWorkspaceInvite[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  branchNames: ReadonlyMap<string, string>;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

async function copyLink(token: string, successMessage = "Đã sao chép liên kết") {
  try {
    await navigator.clipboard.writeText(ownerInviteLink(token));
    toast.success(successMessage);
  } catch {
    toast.error("Trình duyệt chặn sao chép", { description: ownerInviteLink(token) });
  }
}

/**
 * Lời mời chưa được dùng (chỉ Trưởng đơn vị thấy — RLS). Hệ thống chưa gửi email
 * nên đây là nơi lấy lại liên kết; lời mời hết hạn thì "Mời lại" tạo liên kết mới.
 */
export function OwnerInvitesCard({ workspaceId, invites, isLoading, isError, onRetry, branchNames }: Props) {
  const revoke = useRevokeOwnerInvite(workspaceId);
  const reinvite = useCreateOwnerInvite(workspaceId);

  const handleRevoke = async (invite: OwnerWorkspaceInvite) => {
    try {
      await revoke.mutateAsync(invite.id);
      toast.success(`Đã thu hồi lời mời gửi ${invite.email}`);
    } catch (err) {
      toast.error("Chưa thu hồi được", { description: ownerWsErrorMessage(err) });
    }
  };

  const handleReinvite = async (invite: OwnerWorkspaceInvite) => {
    try {
      const res = await reinvite.mutateAsync({
        email: invite.email,
        role: invite.role,
        branchScope: invite.branchScope,
      });
      await copyLink(res.token, "Đã tạo liên kết mới và sao chép");
    } catch (err) {
      toast.error("Chưa mời lại được", { description: ownerWsErrorMessage(err) });
    }
  };

  const busy = revoke.isPending || reinvite.isPending;

  return (
    <SectionCard title="Lời mời đang chờ" icon={MailPlus} count={invites.length}>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : isError ? (
        <EmptyState
          compact
          tone="destructive"
          icon={MailPlus}
          title="Chưa tải được danh sách lời mời."
          action={
            <Button size="sm" variant="outline" onClick={onRetry}>
              Thử lại
            </Button>
          }
        />
      ) : invites.length === 0 ? (
        <EmptyState compact icon={MailPlus} title="Không có lời mời nào đang chờ." />
      ) : (
        <ul className="divide-y text-sm">
          {invites.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3">
              <div className="min-w-0 flex-1 basis-full sm:basis-auto">
                <p className="truncate font-medium text-foreground">{inv.email}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {OWNER_WS_ROLE_LABEL[inv.role]} · {scopeLabel(inv.role, inv.branchScope, branchNames).text}
                </p>
              </div>
              {inv.isExpired ? (
                <Badge variant="outline" className="border-warning/40 bg-warning/15 font-normal text-foreground">
                  Đã hết hạn
                </Badge>
              ) : (
                <span className="text-xs tabular-nums text-muted-foreground">Hết hạn {formatDate(inv.expiresAt)}</span>
              )}
              <div className="ml-auto flex items-center gap-1">
                {inv.isExpired ? (
                  <Button size="sm" variant="outline" className="h-8 gap-1" disabled={busy} onClick={() => void handleReinvite(inv)}>
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Mời lại
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title="Sao chép liên kết"
                    aria-label={`Sao chép liên kết mời ${inv.email}`}
                    onClick={() => void copyLink(inv.token)}
                  >
                    <Copy className="h-4 w-4" strokeWidth={1.5} />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-muted-foreground"
                  disabled={busy}
                  onClick={() => void handleRevoke(inv)}
                >
                  Thu hồi
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
