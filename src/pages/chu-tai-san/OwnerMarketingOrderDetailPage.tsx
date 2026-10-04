import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketingCrumb } from "@/components/asset-owner-portal/marketing/campaigns/MarketingCrumb";
import { CancelMarketingOrderDialog } from "@/components/asset-owner-portal/marketing/orders/CancelMarketingOrderDialog";
import { formatOrderDate } from "@/components/asset-owner-portal/marketing/orders/format";
import { OrderDeliverables } from "@/components/asset-owner-portal/marketing/orders/detail/OrderDeliverables";
import { OrderHero } from "@/components/asset-owner-portal/marketing/orders/detail/OrderHero";
import { OrderImpact } from "@/components/asset-owner-portal/marketing/orders/detail/OrderImpact";
import { OrderRequestCard } from "@/components/asset-owner-portal/marketing/orders/detail/OrderRequestCard";
import { EmptyState } from "@/components/asset-owner-portal/ui/EmptyState";
import { SectionCard } from "@/components/asset-owner-portal/ui/SectionCard";
import {
  useMarketingOrderImpact,
  useMarketingOrderResults,
  useOwnerMarketingOrder,
} from "@/hooks/useOwnerMarketingOrders";
import { useOwnerWorkspace } from "@/hooks/useOwnerWorkspace";
import { useWorkspaceBranchOptions } from "@/hooks/useOwnerWorkspaceMembers";
import { ownerOrdersHref } from "@/lib/ownerMarketing/orders";
import { buildDeliverables } from "@/lib/ownerMarketing/orderReport";

/**
 * Chi tiết đơn "Giao việc cho sàn" — /chu-tai-san/truyen-thong/giao-viec/:id (design 979d4c55
 * "Chi Tiet Don Giao Viec Cho San"). Hero: trạng thái + thẻ việc tiếp theo / kết quả nhanh + thanh tiến độ;
 * dưới: tổng kết của sàn, hạng mục sàn đã làm, tác động lên tài sản; cột phải là yêu cầu đã gửi.
 * Không bao giờ có danh sách người nhận (B2 — khán giả của sàn thuộc về sàn). Chỉ đơn của Trạm đang chọn.
 */
const OwnerMarketingOrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workspaceId, isLoading: wsLoading, canIn } = useOwnerWorkspace();
  const { data, isLoading, isError, refetch } = useOwnerMarketingOrder(id);
  const { data: branches } = useWorkspaceBranchOptions(workspaceId);
  const [cancelling, setCancelling] = useState(false);

  const listHref = ownerOrdersHref();
  const order = data && data.workspace_id === workspaceId ? data : null;
  const started = order?.status === "in_progress" || order?.status === "completed";
  const results = useMarketingOrderResults(order?.id, started);
  const impact = useMarketingOrderImpact(order?.id, started);

  if (wsLoading || isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="space-y-5">
        <MarketingCrumb trail={[{ label: "Giao việc cho sàn", to: listHref }]} />
        <EmptyState
          icon={Handshake}
          tone={isError ? "destructive" : "muted"}
          title={isError ? "Chưa tải được đơn." : "Không tìm thấy đơn"}
          description={isError ? undefined : "Đơn có thể thuộc đơn vị khác với đơn vị bạn đang chọn."}
          action={
            isError ? (
              <Button variant="outline" onClick={() => refetch()}>
                Thử lại
              </Button>
            ) : (
              <Button onClick={() => navigate(listHref)}>Về danh sách đơn</Button>
            )
          }
        />
      </div>
    );
  }

  const canShare = canIn("truyen-thong", "share", order.branch_id);
  const branchName = order.branch_id ? (branches?.find((b) => b.id === order.branch_id)?.label ?? null) : null;

  return (
    <div className="space-y-5">
      <MarketingCrumb trail={[{ label: "Giao việc cho sàn", to: listHref }, { label: order.code }]} />
      <OrderHero order={order} impact={impact.data} impactLoading={started && impact.isLoading} canShare={canShare} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          {order.result_note && (
            <div className="space-y-1 rounded-[10px] bg-success/10 px-4 py-3.5">
              <p className="text-xs font-semibold text-success">
                Sàn tổng kết{order.completed_at ? ` · ${formatOrderDate(order.completed_at)}` : ""}
              </p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{order.result_note}</p>
            </div>
          )}
          {started ? (
            <>
              <OrderDeliverables items={buildDeliverables(order, results.data ?? null)} isLoading={results.isLoading} />
              <OrderImpact impact={impact.data} isLoading={impact.isLoading} isError={impact.isError} />
            </>
          ) : (
            <SectionCard title="Kết quả truyền thông">
              <p className="text-[13.5px] text-muted-foreground">
                {order.status === "cancelled"
                  ? "Đơn đã huỷ — không có kết quả."
                  : "Khi sàn nhận việc, bạn sẽ thấy ở đây từng hạng mục sàn chạy, số liệu của mỗi kênh và mức tăng lượt xem, đăng ký của tài sản."}
              </p>
            </SectionCard>
          )}
        </div>
        <OrderRequestCard
          order={order}
          branchName={branchName}
          cancellable={canShare && (order.status === "requested" || order.status === "quoted")}
          onCancel={() => setCancelling(true)}
        />
      </div>

      <CancelMarketingOrderDialog
        orderId={cancelling ? order.id : null}
        code={order.code}
        onOpenChange={(v) => !v && setCancelling(false)}
        onCancelled={() => setCancelling(false)}
      />
    </div>
  );
};

export default OwnerMarketingOrderDetailPage;
