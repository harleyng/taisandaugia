import { LockedBlur } from "@/components/paywall/LockedBlur";
import { useAuthDialog } from "@/contexts/AuthDialogContext";
import { Card } from "@/components/ui/card";
import { BarChart3, PieChart, TrendingUp, Users } from "lucide-react";

const previewSections = [
  { icon: Users, title: "Tổng quan thị trường", desc: "Phân bố phiên đấu giá theo tỉnh/thành" },
  { icon: BarChart3, title: "Cạnh tranh & chênh lệch", desc: "So sánh delta giá trúng các nhóm tài sản" },
  { icon: PieChart, title: "Kết quả & không thành", desc: "Tỉ lệ thành công và tổ chức lại" },
  { icon: TrendingUp, title: "Xu hướng giá", desc: "Diễn biến giá theo quý ở các khu vực" },
];

export const ReportLockedCTA = () => {
  const { openAuthDialog } = useAuthDialog();

  return (
    <LockedBlur
      teaser="Đăng nhập để xem báo cáo đầy đủ"
      ctaLabel="Đăng nhập / Đăng ký"
      onUnlockClick={() => openAuthDialog()}
      futureNote="Bạn sẽ unlock 4 phần phân tích chi tiết: Tổng quan, Cạnh tranh, Kết quả và Xu hướng giá."
    >
      <div className="space-y-4">
        {previewSections.map(({ icon: Icon, title, desc }) => (
          <Card key={title} className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground mb-4">{desc}</p>
                {/* Mock chart bars */}
                <div className="space-y-2">
                  <div className="h-2.5 rounded-full bg-muted w-[88%]" />
                  <div className="h-2.5 rounded-full bg-muted w-[72%]" />
                  <div className="h-2.5 rounded-full bg-muted w-[55%]" />
                  <div className="h-2.5 rounded-full bg-muted w-[40%]" />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </LockedBlur>
  );
};
