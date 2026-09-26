import { GitBranch, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import { useAssetOwnerWorkspace } from "@/hooks/useAssetOwnerWorkspace";
import type { AssetOwnerWorkspace } from "@/types/asset-owner";

interface Props {
  workspace: AssetOwnerWorkspace;
  /** Không phải Trưởng đơn vị ⇒ chỉ xem, không khớp lại. */
  readOnly?: boolean;
}

/**
 * Thay cho WorkspaceAliasPanel ở Trạm của CHI NHÁNH (match_scope = 'entity',
 * Phase 13). Không có alias / đơn vị thành viên để chỉnh: run_workspace_match chỉ
 * nhận tin đứng tên đúng thực thể chi nhánh, bỏ qua mọi seed tên — nên sửa alias
 * ở đây sẽ không có tác dụng và dễ gây hiểu lầm.
 */
export function BranchEntityScopePanel({ workspace, readOnly = false }: Props) {
  const { runMatch } = useAssetOwnerWorkspace();

  return (
    <SectionCard
      title="Phạm vi tài sản"
      icon={GitBranch}
      actions={
        !readOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => runMatch.mutate()}
            disabled={runMatch.isPending}
            className="gap-1.5"
          >
            {runMatch.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />}
            Khớp lại
          </Button>
        )
      }
    >
      <div className="space-y-2 text-sm">
        <p className="text-foreground">
          Trạm Điều Hành này chỉ nhận tài sản đứng tên{" "}
          <strong>«{workspace.primary_name}»</strong>.
        </p>
        <p className="text-xs text-muted-foreground">
          Tài sản của trụ sở và các chi nhánh khác không tự động gán vào. Bấm "Khớp lại" để nhận các
          tin mới đứng tên chi nhánh vừa lên sàn.
        </p>
      </div>
    </SectionCard>
  );
}
