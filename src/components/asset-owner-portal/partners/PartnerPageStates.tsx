import { useNavigate } from "react-router-dom";
import { BookUser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";
import { DOSSIER_KIND_LABEL, type DossierKind } from "@/lib/dossier/types";

export function PartnersSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}

export function PartnersNoWorkspace() {
  const navigate = useNavigate();
  return (
    <OwnerNoWorkspaceState icon={BookUser}>
      <EmptyState
        icon={BookUser}
        title="Chưa có không gian làm việc"
        description="Đối tác của tôi dành cho chủ tài sản là tổ chức đã xác thực, hoặc người được một đơn vị mời vào."
        action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Xác thực tổ chức</Button>}
      />
    </OwnerNoWorkspaceState>
  );
}

export function PartnersLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      icon={BookUser}
      tone="destructive"
      title="Chưa tải được bảng điểm đối tác."
      action={
        <Button variant="outline" onClick={onRetry}>
          Thử lại
        </Button>
      }
    />
  );
}

/** Tab chưa có đối tác nào: chỉ đường sang nơi khai đối tác (Hồ sơ dịch vụ của hồ sơ số hoá). */
export function PartnersEmpty({ kind }: { kind: DossierKind }) {
  const navigate = useNavigate();
  return (
    <EmptyState
      icon={BookUser}
      title={`Chưa có đối tác ${DOSSIER_KIND_LABEL[kind].toLowerCase()}`}
      description="Khi số hoá tài sản, chọn «Đã có đối tác» ở phần Hồ sơ dịch vụ và nhập đơn vị bạn đang dùng — kết quả phiên sẽ được so ở đây."
      action={
        <Button variant="outline" onClick={() => navigate("/chu-tai-san/dang-tai-san")}>
          Mở Số hoá tài sản
        </Button>
      }
    />
  );
}
