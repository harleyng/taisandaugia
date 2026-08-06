import { ListPager } from "@/components/admin/crm/ListPager";
import { usePager } from "@/hooks/usePager";
import { TicketRowCard, type TicketActions } from "./TicketRowCard";
import type { Ticket } from "@/types/tickets";

/**
 * Danh sách ticket dạng thẻ (phẳng, có phân trang) — dùng cho panel nhúng ở
 * trang chi tiết. Cổng tập trung /admin/tickets vẫn dùng bảng TicketTable vì ở
 * đó cần so sánh nhiều cột giữa các hàng.
 */
export function TicketListView({
  tickets,
  actions,
  hideRelation,
  pageSize = 5,
}: {
  tickets: Ticket[];
  actions: TicketActions;
  hideRelation?: boolean;
  pageSize?: number;
}) {
  const { paged, pager } = usePager(tickets, pageSize);

  return (
    <div className="space-y-2">
      {paged.map((t) => (
        <TicketRowCard key={t.id} ticket={t} actions={actions} hideRelation={hideRelation} />
      ))}
      <ListPager pager={pager} />
    </div>
  );
}
