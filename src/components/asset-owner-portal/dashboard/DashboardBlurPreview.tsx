import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { LockedBlur } from "@/components/paywall/LockedBlur";
import { BarChart3, TrendingUp, Calendar } from "lucide-react";

const PREVIEW_SECTIONS = [
  {
    icon: BarChart3,
    title: "Phân tích sâu",
    lines: ["Tỷ lệ đấu thành công", "Số lần đấu trung bình", "Danh sách tài sản tồn đọng", "Diễn biến giá khởi điểm"],
  },
  {
    icon: TrendingUp,
    title: "So sánh ngữ cảnh",
    lines: ["Tổ hợp lọc vs toàn danh mục", "Điểm bất thường đáng chú ý", "Phân bố theo tổ chức đấu giá"],
  },
  {
    icon: Calendar,
    title: "Lịch & hành động",
    lines: ["Lịch phiên đấu sắp tới", "Danh sách cần xử lý ưu tiên", "Hạn đăng ký sắp đến"],
  },
];

export function DashboardBlurPreview() {
  const navigate = useNavigate();

  const mockContent = (
    <div className="grid md:grid-cols-3 gap-4">
      {PREVIEW_SECTIONS.map(({ icon: Icon, title, lines }) => (
        <Card key={title} className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          </div>
          <div className="space-y-2">
            {lines.map((line, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-2 rounded-full bg-muted flex-1" style={{ width: `${60 + i * 10}%` }} />
                <span className="text-xs text-muted-foreground truncate">{line}</span>
              </div>
            ))}
          </div>
          <div className="h-16 rounded-lg bg-muted/40" />
        </Card>
      ))}
    </div>
  );

  return (
    <div className="mt-2">
      <LockedBlur
        teaser="Xem phân tích sâu, so sánh ngữ cảnh và lịch phiên đấu trong báo cáo đầy đủ"
        ctaLabel="Xem báo cáo chi tiết"
        onUnlockClick={() => navigate("/chu-tai-san/bao-cao")}
        minHeight="280px"
      >
        {mockContent}
      </LockedBlur>
    </div>
  );
}
