import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import { formatVnd } from "@/lib/advertising/slug";
import { serviceKind } from "@/lib/serviceRequests/kinds";
import type { ServiceRequestRow } from "@/lib/serviceRequests/normalize";
import { ServiceStatusBadge } from "./DetailSection";

/** Bảng gộp mọi loại yêu cầu dịch vụ — "Việc tiếp theo" + cảnh báo để vận hành biết việc nào đang chờ mình. */
export function ServiceRequestTable({
  rows,
  showKind,
  onOpen,
}: {
  rows: ServiceRequestRow[];
  showKind: boolean;
  onOpen: (row: ServiceRequestRow) => void;
}) {
  if (rows.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Không có yêu cầu dịch vụ nào.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            {showKind && <th className="px-4 py-2.5 font-medium">Loại</th>}
            <th className="px-4 py-2.5 font-medium">Mã</th>
            <th className="px-4 py-2.5 font-medium">Tài sản</th>
            <th className="px-4 py-2.5 font-medium">Gói · Đối tác</th>
            <th className="px-4 py-2.5 text-right font-medium">Giá báo</th>
            <th className="px-4 py-2.5 font-medium">Trạng thái</th>
            <th className="px-4 py-2.5 font-medium">Việc tiếp theo</th>
            <th className="px-4 py-2.5 font-medium">Tạo lúc</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const kind = serviceKind(r.kind);
            return (
              <tr
                key={`${r.kind}:${r.id}`}
                onClick={() => onOpen(r)}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
              >
                {showKind && (
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-foreground">
                      <kind.icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {kind.label}
                    </span>
                  </td>
                )}
                <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{r.code}</td>
                <td className="max-w-[220px] truncate px-4 py-3 text-foreground" title={r.postingTitle}>
                  {r.postingTitle}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.variant ?? "—"}
                  <span className="block text-xs">
                    {[r.expertName, r.partnerName].filter(Boolean).join(" · ") || "Chưa phân công"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-foreground">
                  {r.quotedPrice != null ? formatVnd(r.quotedPrice) : "—"}
                </td>
                <td className="px-4 py-3">
                  <ServiceStatusBadge status={r.status} label={r.statusLabel} />
                  {r.resultLabel && <span className="mt-1 block text-xs text-muted-foreground">{r.resultLabel}</span>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {r.nextAction}
                  {r.alert && (
                    <span className="mt-1 flex items-center gap-1 font-medium text-destructive">
                      <AlertTriangle className="h-3 w-3" /> {r.alert}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {format(new Date(r.createdAt), "dd/MM/yyyy", { locale: vi })}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
