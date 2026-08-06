import { AlertTriangle, CheckCircle2, Percent, ShieldOff, Users } from "lucide-react";
import type { CpdSummary } from "@/lib/personnel/cpd";

interface Props {
  summary: CpdSummary;
  loading?: boolean;
}

const SKELETON = "rounded-xl border border-border bg-card animate-pulse";
const vn = (n: number) => n.toLocaleString("vi-VN");

export default function CpdKpiCards({ summary, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`${SKELETON} p-5 h-28`} />
        ))}
      </div>
    );
  }

  // Trạng thái tuân thủ đi kèm ICON + NHÃN, không bao giờ chỉ bằng màu.
  const cards = [
    {
      label: "ĐGV thuộc diện áp dụng",
      value: vn(summary.total),
      sub: "Đang hành nghề tại tổ chức",
      icon: Users,
      color: "text-primary bg-primary/10",
      border: "border-primary/20",
    },
    {
      label: "Đã hoàn thành",
      value: vn(summary.met),
      sub: "Đủ 8 giờ hoặc hình thức thay thế",
      icon: CheckCircle2,
      color: "text-success bg-success/10",
      border: "border-success/20",
    },
    {
      label: "Chưa hoàn thành",
      value: vn(summary.short + summary.overdue),
      sub: summary.overdue > 0 ? `${vn(summary.overdue)} đã quá hạn` : "Còn trong năm",
      icon: AlertTriangle,
      color: "text-warning bg-warning/10",
      border: "border-warning/20",
    },
    {
      label: "Được miễn",
      value: vn(summary.exempt),
      sub: "Điều 26.3 TT 19/2024",
      icon: ShieldOff,
      color: "text-muted-foreground bg-muted",
      border: "border-border",
    },
    {
      label: "Tỉ lệ tuân thủ",
      value: `${Math.round(summary.ratio * 100)}%`,
      sub: `${vn(summary.met + summary.exempt)}/${vn(summary.total)} đấu giá viên`,
      icon: Percent,
      color: "text-purple-600 bg-purple-50",
      border: "border-purple-200",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-xl border ${c.border} bg-card p-5`}>
          <div className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.color}`}>
              <c.icon className="h-4 w-4" />
            </span>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
          <p className="text-2xl font-semibold mt-2">{c.value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
