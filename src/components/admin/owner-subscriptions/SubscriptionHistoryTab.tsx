import type { AdminSubDetail } from "@/hooks/useAdminOwnerSubscriptions";
import { ACTIVATION_METHOD_LABELS, formatSubDate } from "@/lib/ownerSubscription/status";
import { formatMoneyFull } from "@/utils/money";

const EVENT_LABELS: Record<string, string> = {
  created: "Tạo gói",
  settings_updated: "Sửa cấu hình",
  offered: "Gửi chào gói",
  unpublished: "Thu hồi về nháp",
  cancelled: "Huỷ gói",
  activated_manual: "Kích hoạt tay",
  paid_online: "Thanh toán online",
};

const dateTime = (iso: string) =>
  `${formatSubDate(iso)} ${new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;

function eventDetail(type: string, payload: Record<string, unknown>): string {
  if (type === "cancelled" && payload.reason) return `Lý do: ${payload.reason}`;
  if (type === "activated_manual" || type === "paid_online") {
    const range = `${formatSubDate(payload.starts_on as string)} – ${formatSubDate(payload.ends_on as string)}`;
    return `${range} · ${formatMoneyFull(payload.amount_vnd as number)}`;
  }
  return "";
}

/** Các kỳ đã trả / đã cấp (kèm mã đơn doanh thu) + nhật ký thao tác. */
export function SubscriptionHistoryTab({ detail }: { detail: AdminSubDetail }) {
  const { terms, events, actors } = detail;
  return (
    <div className="space-y-6">
      <section className="overflow-x-auto rounded-2xl border bg-card">
        <div className="border-b px-4 py-3 text-sm font-semibold text-foreground">Các kỳ</div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Hiệu lực</th>
              <th className="px-4 py-3 font-medium">Số tháng</th>
              <th className="px-4 py-3 font-medium">Nguồn</th>
              <th className="px-4 py-3 text-right font-medium">Số tiền</th>
              <th className="px-4 py-3 font-medium">Đơn hàng</th>
              <th className="px-4 py-3 font-medium">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {terms.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Chưa có kỳ nào được trả hoặc kích hoạt.</td>
              </tr>
            )}
            {terms.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="whitespace-nowrap px-4 py-2.5">{formatSubDate(t.starts_on)} – {formatSubDate(t.ends_on)}</td>
                <td className="px-4 py-2.5">{t.months}</td>
                <td className="px-4 py-2.5">
                  {t.source === "vnpay" ? "VNPay" : t.method ? ACTIVATION_METHOD_LABELS[t.method] : "Kích hoạt tay"}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatMoneyFull(t.amount_vnd)}</td>
                <td className="px-4 py-2.5">{t.order?.code ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{t.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border bg-card">
        <div className="border-b px-4 py-3 text-sm font-semibold text-foreground">Nhật ký</div>
        {events.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Chưa có thao tác.</p>
        ) : (
          <ul className="divide-y">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm">
                <span>
                  <span className="font-medium text-foreground">{EVENT_LABELS[e.event_type] ?? e.event_type}</span>
                  {eventDetail(e.event_type, e.payload) && (
                    <span className="text-muted-foreground"> · {eventDetail(e.event_type, e.payload)}</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {e.actor_id ? actors[e.actor_id] ?? "—" : "Hệ thống"} · {dateTime(e.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
