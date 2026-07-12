import { AdPositionsCard } from "@/components/admin/advertising/masterdata/AdPositionsCard";

export default function AdminAdPositionsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Vị trí quảng cáo</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Master data: vị trí hiển thị, loại slide/duy nhất và giá tiền
        </p>
      </div>

      <AdPositionsCard />
    </div>
  );
}
