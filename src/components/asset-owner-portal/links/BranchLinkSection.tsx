import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Building2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { ActionCard } from "@/components/asset-owner-portal/ui/ActionCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { ReadOnlyNote } from "@/components/asset-owner-portal/pulse/PulseListParts";
import {
  useRespondOwnerLink,
  type OwnerLinkIncoming,
  type OwnerLinkOverview,
} from "@/hooks/useOwnerWorkspaceLinks";
import { ownerWsErrorMessage } from "@/lib/ownerWorkspace/errors";
import { AcceptLinkDialog } from "./AcceptLinkDialog";
import type { UnlinkTarget } from "./ConfirmUnlinkDialog";

interface Props {
  workspaceId: string;
  overview: OwnerLinkOverview;
  /** Trưởng đơn vị (manage_workspace) — người khác chỉ xem. */
  canManage: boolean;
  onUnlink: (target: UnlinkTarget) => void;
}

const dateOf = (iso: string | null) => (iso ? format(parseISO(iso), "dd/MM/yyyy") : "");

/** Phía chi nhánh: trụ sở đang liên kết + yêu cầu đang chờ trả lời. */
export function BranchLinkSection({ workspaceId, overview, canManage, onUnlink }: Props) {
  const respond = useRespondOwnerLink(workspaceId);
  const [accepting, setAccepting] = useState<OwnerLinkIncoming | null>(null);
  const { parent, incoming } = overview;
  const parentName = overview.entity?.parent_name;

  const decline = async (req: OwnerLinkIncoming) => {
    try {
      await respond.mutateAsync({ requestId: req.request_id, accept: false });
      toast.success(`Đã từ chối yêu cầu của ${req.workspace_name}`);
    } catch (err) {
      toast.error("Chưa từ chối được", { description: ownerWsErrorMessage(err) });
    }
  };

  return (
    <SectionCard title="Trụ sở" icon={Building2} count={incoming.length}>
      {parent ? (
        <ActionCard
          icon={Link2}
          tone="success"
          title={`Đang liên kết với ${parent.workspace_name}`}
          meta={`Từ ${dateOf(parent.linked_at)} · Trụ sở chỉ xem số liệu, không sửa và không thấy danh sách thành viên`}
          actions={
            canManage ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  onUnlink({ childWorkspaceId: workspaceId, otherName: parent.workspace_name, side: "branch" })
                }
              >
                Huỷ liên kết
              </Button>
            ) : (
              <ReadOnlyNote />
            )
          }
        />
      ) : incoming.length === 0 ? (
        <EmptyState
          compact
          icon={Building2}
          title="Chưa có yêu cầu liên kết từ trụ sở"
          description={
            parentName ? `Khi ${parentName} gửi yêu cầu, bạn sẽ thấy ở đây.` : undefined
          }
        />
      ) : null}

      {incoming.length > 0 && (
        <div className="space-y-2">
          {incoming.map((req) => (
            <ActionCard
              key={req.request_id}
              icon={Building2}
              tone="warning"
              title={`${req.workspace_name} muốn liên kết làm trụ sở`}
              meta={`Gửi ${dateOf(req.requested_at)}${req.entity_name ? ` · ${req.entity_name}` : ""}`}
              actions={
                canManage ? (
                  <>
                    <Button size="sm" onClick={() => setAccepting(req)}>
                      Đồng ý
                    </Button>
                    <Button size="sm" variant="outline" disabled={respond.isPending} onClick={() => void decline(req)}>
                      Từ chối
                    </Button>
                  </>
                ) : (
                  <ReadOnlyNote>Chỉ Trưởng đơn vị trả lời được</ReadOnlyNote>
                )
              }
            />
          ))}
        </div>
      )}

      <AcceptLinkDialog request={accepting} onClose={() => setAccepting(null)} workspaceId={workspaceId} />
    </SectionCard>
  );
}
