import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { EmptyState } from "./EmptyState";

interface OwnerNoWorkspaceStateProps {
  icon: LucideIcon;
  /** Trạng thái riêng của trang khi người dùng chưa thuộc không gian nào. */
  children: ReactNode;
}

/**
 * Trang chỉ có nghĩa với KHÔNG GIAN (Nhịp đập, Kết quả phiên, Chi nhánh…) khi
 * tenant đang chọn là "Cá nhân" (Phase 4): đừng mời xác thực tổ chức lần nữa —
 * chỉ đường sang không gian của họ, hoặc về hồ sơ cá nhân. Không ở tenant Cá
 * nhân ⇒ giữ nguyên trạng thái riêng của trang (`children`).
 */
export function OwnerNoWorkspaceState({ icon, children }: OwnerNoWorkspaceStateProps) {
  const navigate = useNavigate();
  const { isPersonal, memberships, selectWorkspace } = useOwnerWorkspace();

  if (!isPersonal) return <>{children}</>;

  const target = memberships[0];
  return (
    <div className="py-24">
      {target ? (
        <EmptyState
          icon={icon}
          title="Bạn đang ở không gian Cá nhân"
          description={`Mục này dành cho đơn vị. Chuyển sang «${target.workspace.primary_name}» để xem.`}
          action={
            <Button onClick={() => selectWorkspace(target.workspaceId)}>
              Chuyển sang {target.workspace.primary_name}
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={icon}
          title="Mục này dành cho chủ tài sản là tổ chức"
          description="Tài sản của riêng bạn nằm ở mục Số hoá tài sản."
          action={<Button onClick={() => navigate("/chu-tai-san/dang-tai-san")}>Mở Số hoá tài sản</Button>}
        />
      )}
    </div>
  );
}
