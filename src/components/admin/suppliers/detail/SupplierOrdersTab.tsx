import { Loader2 } from "lucide-react";
import { formatVnd, groupNumber } from "@/lib/advertising/slug";
import { commissionLabel } from "@/lib/supplierContracts";
import { useSupplierOrders } from "@/hooks/useOrders";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("vi-VN") : "—";

const STATUS_LABELS: Record<string, string> = {
  pending: "Chờ xử lý",
  fulfilled: "Đã trả quyền lợi",
  cancelled: "Đã hủy",
};

/**
 * Đơn hoa hồng đã ghi nhận với đối tác — dùng để đối soát.
 *
 * `amount` là tiền THỰC VỀ SÀN (con số báo cáo cộng); `gross_amount` là giá trị
 * hợp đồng khách trả cho đối tác và KHÔNG cộng vào doanh thu. Hai cột phải đứng
 * cạnh nhau, đừng gộp.
 */
export function SupplierOrdersTab({ supplierId }: { supplierId: string }) {
  const { data: orders, isLoading } = useSupplierOrders(supplierId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const list = orders ?? [];

  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Chưa có đơn hoa hồng nào với đối tác này.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left font-medium">Mã đơn</th>
              <th className="px-4 py-2.5 text-left font-medium">Ngày</th>
              <th className="px-4 py-2.5 text-left font-medium">Dịch vụ</th>
              <th className="px-4 py-2.5 text-right font-medium">Giá trị hợp đồng</th>
              <th className="px-4 py-2.5 text-right font-medium">Mức</th>
              <th className="px-4 py-2.5 text-right font-medium">Hoa hồng về sàn</th>
              <th className="px-4 py-2.5 text-left font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {o.code ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.ordered_at)}</td>
                <td className="px-4 py-3 text-foreground">{o.service?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {formatVnd(o.gross_amount)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {commissionLabel(o.commission_type, o.commission_value, groupNumber)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                  {formatVnd(o.amount)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {STATUS_LABELS[o.fulfillment_status] ?? o.fulfillment_status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
