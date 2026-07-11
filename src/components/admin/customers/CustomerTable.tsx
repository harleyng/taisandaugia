import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerStatusBadge } from "./CustomerStatusBadge";
import type { Customer } from "@/types/advertising";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";

interface Props {
  customers: Customer[];
  isLoading: boolean;
  onView: (c: Customer) => void;
  onEdit: (c: Customer) => void;
  onDelete: (c: Customer) => void;
}

export function CustomerTable({ customers, isLoading, onView, onEdit, onDelete }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={TH}>Mã</th>
              <th className={TH}>Tên khách hàng</th>
              <th className={TH}>Loại</th>
              <th className={TH}>Liên hệ</th>
              <th className={TH}>Trạng thái</th>
              <th className={TH}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">Chưa có khách hàng nào.</td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="group cursor-pointer border-b border-border transition-colors hover:bg-muted/30" onClick={() => onView(c)}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono text-xs text-primary group-hover:underline">{c.code ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground group-hover:underline">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.customer_type === "company" ? "Công ty" : "Cá nhân"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {c.phone || "—"}
                    {c.email && <span className="block">{c.email}</span>}
                  </td>
                  <td className="px-4 py-3"><CustomerStatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(c)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
