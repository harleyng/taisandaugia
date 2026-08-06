import { FileText, Coins, Scale, Building2 } from "lucide-react";
import { formatVnd } from "@/lib/advertising/slug";
import type { ListingsKpis } from "@/lib/reports/listingsReport";

interface Props {
  kpis: ListingsKpis;
  loading?: boolean;
}

const SKELETON = "rounded-xl border border-border bg-card animate-pulse";

const vn = (n: number) => n.toLocaleString("vi-VN");

export default function ListingsKpiCards({ kpis, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`${SKELETON} p-5 h-28`} />
        ))}
      </div>
    );
  }

  // Thẻ lớn = số liệu TRONG KỲ (theo ngày đăng tin).
  const cards = [
    {
      label: "Tin mới trong kỳ",
      value: vn(kpis.periodListings),
      sub: `${vn(kpis.views)} lượt xem`,
      icon: FileText,
      color: "text-primary bg-primary/10",
      border: "border-primary/20",
    },
    {
      label: "Giá trị khởi điểm trong kỳ",
      value: formatVnd(kpis.periodValue),
      sub: `${vn(kpis.valuedCount)}/${vn(kpis.periodListings)} tin quy đổi được`,
      icon: Coins,
      color: "text-amber-600 bg-amber-50",
      border: "border-amber-200",
    },
    {
      label: "Giá khởi điểm trung vị",
      value: formatVnd(kpis.medianValue),
      sub: "Nửa số tin dưới mức này",
      icon: Scale,
      color: "text-purple-600 bg-purple-50",
      border: "border-purple-200",
    },
    {
      label: "Tổ chức đấu giá có tin",
      value: vn(kpis.orgs),
      sub: `${vn(kpis.owners)} chủ tài sản · ${vn(kpis.provinces)} tỉnh/thành`,
      icon: Building2,
      color: "text-green-600 bg-green-50",
      border: "border-green-200",
    },
  ];

  // Mốc "toàn sàn" CHỈ hiện khi bộ lọc/khoảng ngày thực sự thu hẹp dữ liệu.
  // Khi đang xem toàn bộ thì nó trùng y hệt thẻ trên và chỉ là nhiễu.
  const narrowed = kpis.totalListings > kpis.periodListings;
  const pct = kpis.totalListings > 0 ? (kpis.periodListings / kpis.totalListings) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(({ label, value, sub, icon: Icon, color, border }) => (
          <div key={label} className={`rounded-xl border ${border} bg-card p-5 space-y-3`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground truncate" title={value}>
                {value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {narrowed && (
        <p className="text-xs text-muted-foreground">
          Đang xem{" "}
          <span className="font-semibold text-foreground tabular-nums">
            {vn(kpis.periodListings)}/{vn(kpis.totalListings)}
          </span>{" "}
          tin toàn sàn ({pct.toFixed(0)}%) — phần còn lại nằm ngoài khoảng thời gian hoặc bộ lọc
          đang áp.
        </p>
      )}
    </div>
  );
}
