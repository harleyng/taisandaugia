import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { OpportunityStageBadge } from "@/components/admin/opportunities/OpportunityStageBadge";
import { formatVnd } from "@/lib/advertising/slug";
import { useCustomerOpportunities } from "@/hooks/useOpportunities";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";
const THR = "px-4 py-2.5 text-right text-xs font-medium text-muted-foreground";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

/** Cơ hội đang mở/đã chốt của khách hàng. Repo chưa có route chi tiết cơ hội —
 *  bấm dòng mở bảng Kanban chung. */
export function CustomerOpportunitiesTab({ customerId }: { customerId: string }) {
  const navigate = useNavigate();
  const { data: opps, isLoading } = useCustomerOpportunities(customerId);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    );
  }

  if (!opps || opps.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">Chưa có cơ hội nào của khách hàng này.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={TH}>Mã</th>
              <th className={TH}>Tên cơ hội</th>
              <th className={TH}>Dịch vụ</th>
              <th className={THR}>Giá trị</th>
              <th className={TH}>Giai đoạn</th>
              <th className={THR}>Dự kiến chốt</th>
            </tr>
          </thead>
          <tbody>
            {opps.map((o) => (
              <tr
                key={o.id}
                className="border-b border-border cursor-pointer transition-colors hover:bg-muted/60"
                onClick={() => navigate("/admin/co-hoi")}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-mono text-xs text-primary">{o.code ?? "—"}</span>
                </td>
                <td className="px-4 py-3 text-foreground">{o.name}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{o.service?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                  {formatVnd(o.amount)}
                </td>
                <td className="px-4 py-3"><OpportunityStageBadge stage={o.stage} /></td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                  {fmtDate(o.expected_close_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
