import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdPagesCard } from "@/components/admin/advertising/masterdata/AdPagesCard";
import { AdPositionsCard } from "@/components/admin/advertising/masterdata/AdPositionsCard";

export default function AdminAdPositionsPage() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/marketing/quang-cao")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">Quản lý vị trí quảng cáo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Master data: trang hiển thị, vị trí, loại slide/duy nhất và giá tiền
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <AdPagesCard />
        <AdPositionsCard />
      </div>
    </div>
  );
}
