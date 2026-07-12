import { AdPagesCard } from "@/components/admin/advertising/masterdata/AdPagesCard";

export default function AdminAdPagesPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Trang quảng cáo</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Master data: các trang hiển thị quảng cáo
        </p>
      </div>

      <AdPagesCard />
    </div>
  );
}
