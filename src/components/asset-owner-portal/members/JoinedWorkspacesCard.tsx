import { useNavigate } from "react-router-dom";
import { ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/asset-owner-portal/ui/IconTile";
import { useOwnerWorkspace, type OwnerWorkspaceMembership } from "@/hooks/useOwnerWorkspace";
import { OWNER_WS_ROLE_LABEL } from "@/lib/ownerWorkspace/roles";

interface Props {
  memberships: OwnerWorkspaceMembership[];
}

/**
 * Lối vào Trạm Điều Hành cho người được MỜI vào không gian của đơn vị khác —
 * họ không có hồ sơ KYC riêng nên các thẻ trạng thái KYC không dẫn họ tới đâu.
 */
export function JoinedWorkspacesCard({ memberships }: Props) {
  const navigate = useNavigate();
  const { selectWorkspace } = useOwnerWorkspace();

  if (memberships.length === 0) return null;

  const open = (workspaceId: string) => {
    selectWorkspace(workspaceId);
    navigate("/chu-tai-san/dashboard");
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2.5">
        <IconTile icon={Users} />
        <h3 className="text-sm font-semibold text-foreground">Không gian bạn tham gia</h3>
      </div>
      <ul className="divide-y divide-border">
        {memberships.map((m) => (
          <li key={m.workspaceId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{m.workspace.primary_name}</p>
              <p className="text-xs text-muted-foreground">{OWNER_WS_ROLE_LABEL[m.role]}</p>
            </div>
            <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1 text-xs" onClick={() => open(m.workspaceId)}>
              Vào Trạm Điều Hành
              <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
