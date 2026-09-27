import { useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { OwnerPageHeader } from "@/components/asset-owner-portal/ui/OwnerPageHeader";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { TargetCrumb } from "@/components/asset-owner-portal/targets/TargetCrumb";
import { TargetEditor } from "@/components/asset-owner-portal/targets/TargetEditor";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useOwnerTargetEditor } from "@/hooks/useOwnerTargets";
import { OWNER_TARGETS_HREF, ownerTargetHref, targetDisplayName, targetTiming } from "@/lib/ownerTargets";
import { firstFreeSlot } from "@/lib/ownerTargetView";

/**
 * "Đặt chỉ tiêu" — /chu-tai-san/chi-tieu/moi · "Sửa chỉ tiêu" — /chu-tai-san/chi-tieu/:id/sua.
 * Trang lo tải dữ liệu + chặn cửa; form ở TargetEditor. Chỉ Trưởng đơn vị (người khác bị
 * đưa về trang xem); kỳ đã hết không sửa được. RLS manage_members mới là cổng thật.
 */
const OwnerTargetFormPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isLoading: wsLoading } = useOwnerWorkspace();
  const { workspaceId, targets, target, inputs, branches, canManage, isLoading, isError, refetch, today } =
    useOwnerTargetEditor(id);

  const initialSlot = useMemo(
    () => firstFreeSlot(targets, branches.filter((b) => b.isActive).map((b) => b.id), today),
    [targets, branches, today],
  );

  if (wsLoading || (workspaceId && isLoading)) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-56" />
        <div className="grid gap-[22px] lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-[420px] rounded-2xl" />
          <Skeleton className="h-60 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!workspaceId) return <Navigate to={OWNER_TARGETS_HREF} replace />;

  if (isError || (id && !target)) {
    return (
      <div className="space-y-5">
        <TargetCrumb />
        <EmptyState
          icon={Target}
          tone={isError ? "destructive" : "muted"}
          title={isError ? "Chưa tải được chỉ tiêu." : "Không tìm thấy chỉ tiêu"}
          description={
            isError ? undefined : "Chỉ tiêu có thể đã bị xoá, hoặc thuộc đơn vị khác với đơn vị bạn đang chọn."
          }
          action={
            isError ? (
              <Button variant="outline" onClick={refetch}>
                Thử lại
              </Button>
            ) : (
              <Button onClick={() => navigate(OWNER_TARGETS_HREF)}>Về danh sách chỉ tiêu</Button>
            )
          }
        />
      </div>
    );
  }

  // Người chỉ xem, hoặc chỉ tiêu đã hết kỳ ⇒ về trang xem.
  if (!canManage || (target && targetTiming(target, today) === "past")) {
    return <Navigate to={target ? ownerTargetHref(target.id) : OWNER_TARGETS_HREF} replace />;
  }

  return (
    <div className="space-y-5">
      <TargetCrumb trail={target ? [{ label: targetDisplayName(target, branches), to: ownerTargetHref(target.id) }] : []} />
      <OwnerPageHeader
        title={target ? "Sửa chỉ tiêu" : "Đặt chỉ tiêu"}
        subtitle="Mỗi kỳ và phạm vi có một chỉ tiêu, gồm một hoặc nhiều tiêu chí."
      />
      <TargetEditor
        key={target?.id ?? "new"}
        workspaceId={workspaceId}
        target={target}
        initialSlot={initialSlot}
        targets={targets}
        branches={branches}
        inputs={inputs}
        today={today}
      />
    </div>
  );
};

export default OwnerTargetFormPage;
