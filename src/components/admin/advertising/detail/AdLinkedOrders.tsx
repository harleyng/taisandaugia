import { useNavigate } from "react-router-dom";
import { useAdvertisementOrders } from "@/hooks/useOrders";
import { formatVnd } from "@/lib/advertising/slug";
import { OrderStatusBadge } from "@/components/admin/orders/OrderStatusBadge";

/** Truy vết ngược: đơn hàng gắn với banner này (orders.advertisement_id). */
export function AdLinkedOrders({ adId }: { adId: string }) {
  const navigate = useNavigate();
  const { data: orders } = useAdvertisementOrders(adId);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 mt-5">
      <h2 className="text-base font-semibold text-foreground mb-3">
        Đơn hàng liên kết ({orders?.length ?? 0})
      </h2>
      {!orders || orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có đơn hàng nào gắn với banner này. Gắn ở trang Đơn hàng để truy vết quyền lợi.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {orders.map((o) => (
            <button
              key={o.id}
              onClick={() => navigate("/admin/don-hang")}
              className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-muted/30 rounded-lg px-2 -mx-2 transition-colors"
            >
              <span className="font-mono text-xs text-primary w-24 shrink-0">{o.code ?? "—"}</span>
              <span className="flex-1 text-sm text-foreground truncate">{o.customer?.name ?? "—"}</span>
              <span className="text-xs text-muted-foreground tabular-nums hidden sm:block">{formatVnd(o.amount)}</span>
              <OrderStatusBadge status={o.fulfillment_status} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
