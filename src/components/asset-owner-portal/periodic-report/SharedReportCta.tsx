import { useNavigate } from "react-router-dom";
import { TowerControl } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/asset-owner-portal/ui/IconTile";
import { CONTROL_TOWER_CONTACT_HREF } from "@/lib/ownerReportShare";

/**
 * Lời mời "Tháp Điều Hành" cuối trang /r/:token — người mở link thường là trụ sở
 * (§A0 land & expand). Không in ra giấy.
 */
export function SharedReportCta() {
  const navigate = useNavigate();

  return (
    <section
      aria-labelledby="shared-report-cta"
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:p-6 print:hidden"
    >
      <IconTile icon={TowerControl} className="self-start sm:self-center" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs text-muted-foreground">Dành cho trụ sở</p>
        <h2 id="shared-report-cta" className="text-base font-semibold text-foreground">
          Xem toàn bộ chi nhánh trên một màn hình — Tháp Điều Hành
        </h2>
        <p className="text-sm text-muted-foreground">
          Kết quả phiên, tiền đã thu và tài sản tồn đọng của mọi chi nhánh ở cùng một nơi, thay vì tổng hợp từng báo cáo
          gửi lên.
        </p>
      </div>
      <Button className="shrink-0" onClick={() => navigate(CONTROL_TOWER_CONTACT_HREF)}>
        Tìm hiểu Tháp Điều Hành
      </Button>
    </section>
  );
}
