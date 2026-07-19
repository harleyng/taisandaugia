import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SupplierStatusBadge, MarketplaceBadge } from "./SupplierStatusBadge";
import { groupNumber } from "@/lib/advertising/slug";
import type { Supplier } from "@/types/supplier";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";

interface Props {
  suppliers: Supplier[];
  isLoading: boolean;
  /** id đối tác -> số dịch vụ đang tham chiếu; > 0 ⇒ chặn xoá (FK RESTRICT). */
  usageById: Record<string, number>;
  /** id đối tác đang có thẻ hiển thị trên trang chủ (partners.supplier_id). */
  shownOnMarketplace: Set<string>;
  onEdit: (s: Supplier) => void;
  onDelete: (s: Supplier) => void;
}

const commissionText = (s: Supplier): string => {
  if (!s.default_commission_type || s.default_commission_rate == null) return "—";
  return s.default_commission_type === "percent"
    ? `${Number(s.default_commission_rate)}%`
    : `${groupNumber(s.default_commission_rate)}₫`;
};

export function SupplierTable({
  suppliers, isLoading, usageById, shownOnMarketplace, onEdit, onDelete,
}: Props) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={TH}>Mã</th>
              <th className={TH}>Đối tác</th>
              <th className={TH}>Liên hệ</th>
              <th className={TH}>Hoa hồng mặc định</th>
              <th className={TH}>Hiển thị</th>
              <th className={TH}>Trạng thái</th>
              <th className={TH}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  Chưa có đối tác nào.
                </td>
              </tr>
            ) : (
              suppliers.map((s) => {
                const inUse = (usageById[s.id] ?? 0) > 0;
                return (
                  <tr key={s.id} className="group border-b border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs text-primary">{s.code ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{s.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {s.supplier_type === "company" ? "Công ty" : "Cá nhân"}
                        {s.tax_code && ` · MST ${s.tax_code}`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {s.contact_name || "—"}
                      {s.phone && <span className="block">{s.phone}</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-foreground">{commissionText(s)}</td>
                    <td className="px-4 py-3"><MarketplaceBadge onMarketplace={shownOnMarketplace.has(s.id)} /></td>
                    <td className="px-4 py-3"><SupplierStatusBadge status={s.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          disabled={inUse}
                          title={inUse ? "Còn dịch vụ đang dùng — hãy chuyển sang Tạm ngưng" : "Xóa"}
                          onClick={() => onDelete(s)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
