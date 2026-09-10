import { Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SupplierStatusBadge, MarketplaceBadge } from "./SupplierStatusBadge";
import { groupNumber } from "@/lib/advertising/slug";
import { EXPIRING_SOON_DAYS, daysUntilExpiry, isInForce } from "@/lib/supplierContracts";
import type { Supplier } from "@/types/supplier";
import type { SupplierContract } from "@/types/supplierContract";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";

interface Props {
  suppliers: Supplier[];
  isLoading: boolean;
  /** id đối tác -> số dịch vụ đang tham chiếu; > 0 ⇒ chặn xoá (FK RESTRICT). */
  usageById: Record<string, number>;
  /** id đối tác đang có thẻ hiển thị trên trang chủ (partners.supplier_id). */
  shownOnMarketplace: Set<string>;
  /** id đối tác -> hợp đồng của họ; dùng cho cột "Hợp đồng". */
  contractsBySupplier: Record<string, SupplierContract[]>;
  onEdit: (s: Supplier) => void;
  onDelete: (s: Supplier) => void;
}

const commissionText = (s: Supplier): string => {
  if (!s.default_commission_type || s.default_commission_rate == null) return "—";
  return s.default_commission_type === "percent"
    ? `${Number(s.default_commission_rate)}%`
    : `${groupNumber(s.default_commission_rate)}₫`;
};

/** Ô "Hợp đồng": số HĐ đang hiệu lực + cảnh báo cái sắp hết hạn sớm nhất. */
function ContractCell({ contracts }: { contracts: SupplierContract[] }) {
  const inForce = contracts.filter((c) => isInForce(c));
  if (inForce.length === 0) {
    return <span className="text-xs text-muted-foreground">Chưa có</span>;
  }

  const soonest = inForce
    .map((c) => daysUntilExpiry(c))
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b)[0];

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-foreground tabular-nums">{inForce.length}</span>
      {soonest !== undefined && soonest <= EXPIRING_SOON_DAYS && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700"
          title={`Hợp đồng sắp hết hạn trong ${soonest} ngày`}
        >
          <AlertTriangle className="h-3 w-3" />
          {soonest}d
        </span>
      )}
    </div>
  );
}

export function SupplierTable({
  suppliers, isLoading, usageById, shownOnMarketplace, contractsBySupplier, onEdit, onDelete,
}: Props) {
  const navigate = useNavigate();
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
              <th className={TH}>Hợp đồng</th>
              <th className={TH}>Hiển thị</th>
              <th className={TH}>Trạng thái</th>
              <th className={TH}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
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
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/doi-tac/${s.id}`)}
                        className="text-left font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {s.name}
                      </button>
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
                    <td className="px-4 py-3">
                      <ContractCell contracts={contractsBySupplier[s.id] ?? []} />
                    </td>
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
