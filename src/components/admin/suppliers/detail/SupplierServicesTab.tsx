import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useServices } from "@/hooks/useServices";

/**
 * Dịch vụ hoa hồng đang trỏ về đối tác này. CHỈ ĐỌC — danh mục dịch vụ do module
 * "Dịch vụ" sở hữu; sửa ở hai nơi sẽ đẻ ra hai nguồn sự thật.
 */
export function SupplierServicesTab({ supplierId }: { supplierId: string }) {
  const navigate = useNavigate();
  const { data: services } = useServices();

  const own = useMemo(
    () => (services ?? []).filter((s) => s.supplier_id === supplierId),
    [services, supplierId],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {own.length} dịch vụ gắn riêng cho đối tác này
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate("/admin/dich-vu")}>
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
          Mở danh mục Dịch vụ
        </Button>
      </div>

      {own.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Chưa có dịch vụ nào gắn riêng cho đối tác này. Dịch vụ dùng chung (ví dụ môi giới
            ký gửi) không hiện ở đây — xem tab Hợp đồng.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left font-medium">Mã</th>
                <th className="px-4 py-2.5 text-left font-medium">Dịch vụ</th>
                <th className="px-4 py-2.5 text-left font-medium">Loại</th>
                <th className="px-4 py-2.5 text-left font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {own.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {s.code ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground">{s.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">
                      {s.kind === "commission" ? "Hoa hồng" : s.kind === "direct" ? "Bán trực tiếp" : "Credit"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {s.is_active ? "Đang bán" : "Ngưng"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
