import { Coins, TrendingUp, Flame, Users } from "lucide-react";
import { formatVnd } from "@/lib/advertising/slug";
import type { RevenueKpis } from "@/lib/reports/transactionReport";

interface Props {
  kpis: RevenueKpis;
  loading?: boolean;
}

const SKELETON = "rounded-xl border border-border bg-card animate-pulse";

export default function ReportKpiCards({ kpis, loading }: Props) {
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
      label: "Doanh thu",
      value: formatVnd(kpis.totalVnd),
      sub: `TB ${formatVnd(kpis.avgOrderVnd)}/đơn`,
      icon: TrendingUp,
      color: "text-primary bg-primary/10",
      border: "border-primary/20",
    },
    {
      label: "Credit bán ra",
      value: kpis.creditsSold.toLocaleString("vi-VN"),
      sub: `${kpis.purchaseCount.toLocaleString("vi-VN")} lượt nạp`,
      icon: Coins,
      color: "text-amber-600 bg-amber-50",
      border: "border-amber-200",
    },
    {
      label: "Credit tiêu dùng",
      value: kpis.creditsSpent.toLocaleString("vi-VN"),
      sub: "Đã dùng vào tính năng",
      icon: Flame,
      color: "text-purple-600 bg-purple-50",
      border: "border-purple-200",
    },
    {
      label: "Người nạp",
      value: kpis.payingUsers.toLocaleString("vi-VN"),
      sub: "User duy nhất đã nạp",
      icon: Users,
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
