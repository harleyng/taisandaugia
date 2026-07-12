import { TrendingUp, Coins, Megaphone, ClipboardList } from "lucide-react";
import { formatVnd } from "@/lib/advertising/slug";
import type { RevenueKpis } from "@/lib/reports/revenueReport";

interface Props {
  kpis: RevenueKpis;
  loading?: boolean;
}

const SKELETON = "rounded-xl border border-border bg-card animate-pulse";

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export default function RevenueSourceKpis({ kpis, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`${SKELETON} p-5 h-28`} />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Doanh thu tổng",
      value: formatVnd(kpis.totalVnd),
      sub:
        kpis.growthPct == null
          ? "Credit + dịch vụ trực tiếp"
          : `${kpis.growthPct >= 0 ? "▲" : "▼"} ${Math.abs(kpis.growthPct)}% so với kỳ trước`,
      icon: TrendingUp,
      color: "text-primary bg-primary/10",
      border: "border-primary/20",
    },
    {
      label: "Doanh thu credit",
      value: formatVnd(kpis.creditVnd),
      sub: `${pct(kpis.creditVnd, kpis.totalVnd)}% tổng · tiền nạp gói`,
      icon: Coins,
      color: "text-amber-600 bg-amber-50",
      border: "border-amber-200",
    },
    {
      label: "Doanh thu dịch vụ",
      value: formatVnd(kpis.directVnd),
      sub: `${pct(kpis.directVnd, kpis.totalVnd)}% tổng · bán trực tiếp`,
      icon: Megaphone,
      color: "text-blue-600 bg-blue-50",
      border: "border-blue-200",
    },
    {
      label: "Số đơn hàng",
      value: kpis.orderCount.toLocaleString("vi-VN"),
      sub: "Đơn dịch vụ (không tính hủy)",
      icon: ClipboardList,
      color: "text-green-600 bg-green-50",
      border: "border-green-200",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(({ label, value, sub, icon: Icon, color, border }) => (
        <div key={label} className={`rounded-xl border ${border} bg-card p-5 space-y-3`}>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            <p className="text-[11px] text-muted-foreground/70 mt-1">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
