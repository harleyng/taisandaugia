import { Activity, Eye, Users, Zap } from "lucide-react";
import type { AccessKpis } from "@/lib/reports/accessAnalytics";

interface Props {
  kpis: AccessKpis;
  loading?: boolean;
}

const SKELETON = "rounded-xl border border-border bg-card animate-pulse";
const num = (n: number) => n.toLocaleString("vi-VN");

export default function AccessKpiCards({ kpis, loading }: Props) {
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
      label: "Lượt truy cập",
      value: num(kpis.totalVisits),
      sub: "Phiên truy cập duy nhất",
      icon: Activity,
      color: "text-primary bg-primary/10",
      border: "border-primary/20",
    },
    {
      label: "Lượt xem trang",
      value: num(kpis.totalPageViews),
      sub: "Tổng page view",
      icon: Eye,
      color: "text-amber-600 bg-amber-50",
      border: "border-amber-200",
    },
    {
      label: "Người dùng hoạt động",
      value: num(kpis.uniqueUsers),
      sub: "User đăng nhập duy nhất",
      icon: Users,
      color: "text-green-600 bg-green-50",
      border: "border-green-200",
    },
    {
      label: "Lượt dùng tính năng",
      value: num(kpis.featureEvents),
      sub: "Sự kiện tính năng",
      icon: Zap,
      color: "text-purple-600 bg-purple-50",
      border: "border-purple-200",
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
