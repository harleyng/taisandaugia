import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderStatusBadge } from "@/components/admin/orders/OrderStatusBadge";
import { formatVnd } from "@/lib/advertising/slug";
import { useCustomerAllOrders } from "@/hooks/useOrders";
import type { Order } from "@/types/orders";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";
const THR = "px-4 py-2.5 text-right text-xs font-medium text-muted-foreground";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

/** Đơn nạp credit không có customer_id — nó gắn vào tài khoản (user_id). Đây là
 *  thứ duy nhất phân biệt hai dòng doanh thu trên cùng một bảng. */
const isTopUp = (o: Order) => !o.customer_id;

interface Props {
  customerId: string;
  userId: string | null;
}

export function CustomerOrdersTab({ customerId, userId }: Props) {
  const navigate = useNavigate();
  const { data: orders, isLoading } = useCustomerAllOrders(customerId, userId);

  const totals = useMemo(() => {
    const list = orders ?? [];
    return {
      count: list.length,
      amount: list.reduce((s, o) => s + Number(o.amount ?? 0), 0),
      topUps: list.filter(isTopUp).length,
    };
  }, [orders]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Chưa có đơn hàng nào của khách hàng này.</p>
        {!userId && (
          <p className="text-xs text-muted-foreground mt-2">
            Khách hàng chưa gắn tài khoản trên sàn nên đơn nạp credit (nếu có) chưa được tính vào đây.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-sm">
        <span className="text-foreground">
          <strong className="tabular-nums">{totals.count}</strong> đơn
        </span>
        <span className="text-foreground">
          Tổng thực về sàn <strong className="tabular-nums">{formatVnd(totals.amount)}</strong>
        </span>
        {totals.topUps > 0 && (
          <span className="text-xs text-muted-foreground">
            trong đó {totals.topUps} đơn nạp credit của tài khoản đã gắn
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className={TH}>Mã</th>
                <th className={TH}>Loại</th>
                <th className={TH}>Dịch vụ</th>
                <th className={THR}>Giá trị</th>
                <th className={TH}>Trạng thái</th>
                <th className={THR}>Ngày</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const topUp = isTopUp(o);
                // Repo chưa có route /admin/don-hang/:id — chỉ bấm được khi đơn
                // gắn banner quảng cáo, còn lại là dòng tĩnh.
                const clickable = !!o.advertisement_id;
                const cells = (
                  <>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs text-primary">{o.code ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          topUp ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {topUp ? "Nạp credit" : "Đơn dịch vụ"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {o.service?.name ?? "—"}
                      {o.advertisement && (
                        <span className="block text-xs text-muted-foreground truncate max-w-[220px]">
                          {o.advertisement.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                      {formatVnd(o.amount)}
                    </td>
                    <td className="px-4 py-3"><OrderStatusBadge status={o.fulfillment_status} /></td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(o.ordered_at)}
                    </td>
                  </>
                );
                return (
                  <tr
                    key={o.id}
                    className={`border-b border-border transition-colors ${
                      clickable ? "cursor-pointer hover:bg-muted/60" : ""
                    }`}
                    onClick={
                      clickable
                        ? () => navigate(`/admin/marketing/quang-cao/${o.advertisement_id}`)
                        : undefined
                    }
                  >
                    {cells}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
