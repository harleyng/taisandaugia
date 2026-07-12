import { Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatVnd } from "@/lib/advertising/slug";
import { OrderStatusBadge } from "./OrderStatusBadge";
import type { Order } from "@/types/orders";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";

interface Props {
  orders: Order[];
  isLoading: boolean;
  onEdit: (o: Order) => void;
  onDelete: (o: Order) => void;
}

export function OrderTable({ orders, isLoading, onEdit, onDelete }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={TH}>Mã</th>
              <th className={TH}>Khách hàng</th>
              <th className={TH}>Dịch vụ</th>
              <th className={`${TH} text-right`}>Số tiền</th>
              <th className={TH}>Trạng thái</th>
              <th className={TH}>Ngày đặt</th>
              <th className={TH}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">Chưa có đơn hàng nào.</td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="group border-b border-border transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-xs text-primary">{o.code ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-foreground">{o.customer?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {o.service?.name ?? "—"}
                    {o.advertisement && (
                      <span className="block text-[11px] text-muted-foreground/70 font-mono">
                        {o.advertisement.code ?? o.advertisement.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">{formatVnd(o.amount)}</td>
                  <td className="px-4 py-3"><OrderStatusBadge status={o.fulfillment_status} /></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                    {o.ordered_at ? format(new Date(o.ordered_at), "dd/MM/yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(o)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(o)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
