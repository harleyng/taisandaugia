import type { MonitorDossierStats as Stats } from "@/lib/auctionMonitor/monitor";

const num = (n: number) => n.toLocaleString("vi-VN");

/** Tổng hồ sơ tham gia — chỉ số đếm, không có dữ liệu cá nhân người mua. */
export function MonitorDossierStats({ stats }: { stats: Stats }) {
  const items: { label: string; value: number; hint?: string }[] = [
    { label: "Hồ sơ", value: stats.total, hint: stats.cancelled ? `${num(stats.cancelled)} đã huỷ` : undefined },
    { label: "Đã nộp phí", value: stats.paid + stats.refunded, hint: stats.pending_payment ? `${num(stats.pending_payment)} chờ thanh toán` : undefined },
    {
      label: "Đã duyệt",
      value: stats.approved,
      hint: [
        stats.review_pending ? `${num(stats.review_pending)} chờ duyệt` : null,
        stats.needs_info ? `${num(stats.needs_info)} cần bổ sung` : null,
        stats.rejected ? `${num(stats.rejected)} từ chối` : null,
      ]
        .filter(Boolean)
        .join(" · ") || undefined,
    },
    { label: "Đã nhận cọc", value: stats.deposit_received },
    { label: "Đã điểm danh", value: stats.checked_in, hint: stats.absent ? `${num(stats.absent)} vắng` : undefined },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="text-xs text-muted-foreground">{it.label}</div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">{num(it.value)}</div>
          {it.hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{it.hint}</div>}
        </div>
      ))}
    </div>
  );
}
