import { SubscriptionUsageBars } from "@/components/owner-subscription/SubscriptionUsageBars";
import type { AdminSubDetail } from "@/hooks/useAdminOwnerSubscriptions";
import { formatSubDate } from "@/lib/ownerSubscription/status";

const REF_LABELS: Record<string, string> = {
  asset_3d_scan: "Phiên quét 3D",
  owner_report_view: "Lượt xem báo cáo",
};

/** Hạn mức kỳ hiện tại + sổ tiêu hạn mức (dòng âm = hoàn lượt khi quét thất bại). */
export function SubscriptionUsageTab({ detail }: { detail: AdminSubDetail }) {
  const { status, usage, actors } = detail;
  const labels = new Map((status?.lines ?? []).map((l) => [l.benefit_key, l.label]));
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Hạn mức hiện tại</h3>
        {status ? (
          <SubscriptionUsageBars lines={status.lines.filter((l) => l.tracked)} />
        ) : (
          <p className="text-sm text-muted-foreground">Chưa có số liệu.</p>
        )}
      </section>

      <section className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Thời điểm</th>
              <th className="px-4 py-3 font-medium">Quyền lợi</th>
              <th className="px-4 py-3 text-right font-medium">Lượt</th>
              <th className="px-4 py-3 font-medium">Người thao tác</th>
              <th className="px-4 py-3 font-medium">Nguồn</th>
            </tr>
          </thead>
          <tbody>
            {usage.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Chưa có lượt dùng nào.</td>
              </tr>
            )}
            {usage.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                  {formatSubDate(u.created_at)} {new Date(u.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2.5">{labels.get(u.benefit_key) ?? u.benefit_key}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${u.qty < 0 ? "text-success" : ""}`}>
                  {u.qty > 0 ? `+${u.qty}` : u.qty}
                </td>
                <td className="px-4 py-2.5">{u.actor_id ? actors[u.actor_id] ?? "—" : "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {u.reverses_id ? u.note ?? "Hoàn lượt" : REF_LABELS[u.ref_type] ?? u.ref_type}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
