import { format, parseISO } from "date-fns";
import { Network } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import {
  useCancelOwnerLinkRequest,
  useRequestOwnerLink,
  type OwnerLinkChild,
  type OwnerLinkChildState,
  type OwnerLinkOverview,
} from "@/hooks/useOwnerWorkspaceLinks";
import { ownerWsErrorMessage } from "@/lib/ownerWorkspace/errors";
import { cn } from "@/lib/utils";
import type { UnlinkTarget } from "./ConfirmUnlinkDialog";

interface Props {
  workspaceId: string;
  overview: OwnerLinkOverview;
  canManage: boolean;
  onUnlink: (target: UnlinkTarget) => void;
}

const STATE_LABEL: Record<OwnerLinkChildState, string> = {
  no_workspace: "Chưa dùng Trạm Điều Hành",
  available: "Đang dùng Trạm — chưa liên kết",
  pending: "Đã gửi yêu cầu, chờ chi nhánh đồng ý",
  linked: "Đã liên kết",
  linked_elsewhere: "Đã liên kết với trụ sở khác",
  ineligible: "Không liên kết được",
};

const dateOf = (iso: string | null) => (iso ? format(parseISO(iso), "dd/MM/yyyy") : "");

function metaOf(child: OwnerLinkChild): string {
  if (child.state === "linked" && child.linked_at) return `Đã liên kết từ ${dateOf(child.linked_at)}`;
  if (child.state === "pending" && child.requested_at) return `Đã gửi yêu cầu ${dateOf(child.requested_at)}, chờ chi nhánh đồng ý`;
  return STATE_LABEL[child.state];
}

/** Phía trụ sở: đơn vị con trong danh bạ + Trạm đã liên kết. */
export function HqLinkSection({ workspaceId, overview, canManage, onUnlink }: Props) {
  const request = useRequestOwnerLink(workspaceId);
  const cancel = useCancelOwnerLinkRequest(workspaceId);
  const busy = request.isPending || cancel.isPending;
  const linkedCount = overview.children.filter((c) => c.state === "linked").length;

  const send = async (child: OwnerLinkChild) => {
    if (!child.workspace_id) return;
    try {
      await request.mutateAsync(child.workspace_id);
      toast.success(`Đã gửi yêu cầu liên kết tới ${child.name}`);
    } catch (err) {
      toast.error("Chưa gửi được yêu cầu", { description: ownerWsErrorMessage(err) });
    }
  };

  const withdraw = async (child: OwnerLinkChild) => {
    if (!child.request_id) return;
    try {
      await cancel.mutateAsync(child.request_id);
      toast.success(`Đã rút yêu cầu gửi ${child.name}`);
    } catch (err) {
      toast.error("Chưa rút được yêu cầu", { description: ownerWsErrorMessage(err) });
    }
  };

  const actionOf = (child: OwnerLinkChild) => {
    if (!canManage) return null;
    switch (child.state) {
      case "available":
        return (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void send(child)}>
            Gửi yêu cầu liên kết
          </Button>
        );
      case "pending":
        return (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void withdraw(child)}>
            Rút yêu cầu
          </Button>
        );
      case "linked":
        return child.workspace_id ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onUnlink({ childWorkspaceId: child.workspace_id!, otherName: child.name, side: "hq" })
            }
          >
            Huỷ liên kết
          </Button>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <SectionCard title="Chi nhánh và đơn vị con" icon={Network} count={linkedCount}>
      <p className="text-sm text-muted-foreground">
        Chi nhánh đồng ý liên kết thì Trưởng đơn vị trụ sở xem được số liệu của họ (chỉ xem) và mở được Trạm của
        họ từ menu tài khoản.
      </p>
      {overview.children.length === 0 ? (
        <EmptyState compact icon={Network} title="Danh bạ chưa ghi nhận đơn vị con nào của đơn vị này" />
      ) : (
        <ul className="divide-y divide-border">
          {overview.children.map((child) => (
            <li
              key={child.workspace_id ?? child.asset_owner_id ?? child.name}
              className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{child.name}</p>
                <p
                  className={cn(
                    "text-xs",
                    child.state === "linked" ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {metaOf(child)}
                </p>
              </div>
              <div className="shrink-0">{actionOf(child)}</div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
