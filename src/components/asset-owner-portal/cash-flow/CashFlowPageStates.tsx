import { useNavigate } from "react-router-dom";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { OwnerNoWorkspaceState } from "@/components/asset-owner-portal/ui/OwnerNoWorkspaceState";

/** Khung chờ chung của Thu tiền / Dòng tiền: tiêu đề, một dải ô, một thẻ lớn. */
export function CashFlowSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-9 w-48" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}

/** Người xem chưa thuộc không gian nào (tenant "Cá nhân"). */
export function CashFlowNoWorkspace({ feature }: { feature: string }) {
  const navigate = useNavigate();
  return (
    <OwnerNoWorkspaceState icon={Wallet}>
      <EmptyState
        icon={Wallet}
        title="Chưa có không gian làm việc"
        description={`${feature} dành cho chủ tài sản là tổ chức đã xác thực, hoặc người được một đơn vị mời vào.`}
        action={<Button onClick={() => navigate("/tro-thanh-chu-tai-san")}>Xác thực tổ chức</Button>}
      />
    </OwnerNoWorkspaceState>
  );
}

export function CashFlowLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      icon={Wallet}
      tone="destructive"
      title="Chưa tải được số liệu thu tiền."
      action={
        <Button variant="outline" onClick={onRetry}>
          Thử lại
        </Button>
      }
    />
  );
}
