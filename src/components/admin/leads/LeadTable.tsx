import { Pencil, Trash2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { SOURCE_LABELS, LEAD_TYPE_LABELS } from "@/lib/leads/leadStatus";
import type { Lead } from "@/types/leads";
import type { CustomerSegment } from "@/lib/customers/customerSegment";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";

interface Props {
  leads: Lead[];
  isLoading: boolean;
  onEdit: (l: Lead) => void;
  onConvert: (l: Lead) => void;
  onDelete: (l: Lead) => void;
}

export function LeadTable({ leads, isLoading, onEdit, onConvert, onDelete }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={TH}>Mã</th>
              <th className={TH}>Tên</th>
              <th className={TH}>Liên hệ</th>
              <th className={TH}>Loại</th>
              <th className={TH}>Nguồn</th>
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
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  Chưa có khách hàng tiềm năng nào.
                </td>
              </tr>
            ) : (
              leads.map((l) => {
                const converted = l.status === "converted";
                return (
                  <tr key={l.id} className="group border-b border-border transition-colors hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs text-primary">{l.code ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{l.name}</span>
                      {l.company_name && (
                        <span className="block text-xs text-muted-foreground">{l.company_name}</span>
                      )}
                      {converted && l.converted_customer && (
                        <span className="block text-[11px] text-green-700">
                          → {l.converted_customer.name} ({l.converted_customer.code})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {l.contact_name || "—"}
                      {l.phone && <span className="block">{l.phone}</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {LEAD_TYPE_LABELS[l.lead_type as CustomerSegment] ?? "Khác"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {SOURCE_LABELS[l.source] ?? l.source}
                    </td>
                    <td className="px-4 py-3"><LeadStatusBadge status={l.status} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1">
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7 text-primary"
                          disabled={converted}
                          title={converted ? "Đã chuyển đổi" : "Chuyển thành khách hàng"}
                          onClick={() => onConvert(l)}
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(l)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => onDelete(l)}
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
