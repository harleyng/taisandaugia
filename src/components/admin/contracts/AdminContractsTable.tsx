import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { formatVnd } from "@/lib/advertising/slug";
import { cn } from "@/lib/utils";
import type { AdminContractRow } from "@/lib/contracts/adminRows";
import { CONTRACT_TONE_CLASS } from "@/lib/contracts/rows";

/** Bảng gộp mọi hợp đồng trên sàn (ký gửi / mua bán / dịch vụ). */
export function AdminContractsTable({
  rows,
  showKind,
  onOpen,
}: {
  rows: AdminContractRow[];
  showKind: boolean;
  onOpen: (row: AdminContractRow) => void;
}) {
  if (rows.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Không có hợp đồng nào.</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Mã</th>
            {showKind && <th className="px-4 py-2.5 font-medium">Loại</th>}
            <th className="px-4 py-2.5 font-medium">Tài sản</th>
            <th className="px-4 py-2.5 font-medium">Các bên</th>
            <th className="px-4 py-2.5 text-right font-medium">Giá trị</th>
            <th className="px-4 py-2.5 font-medium">Trạng thái</th>
            <th className="px-4 py-2.5 font-medium">Ký / đồng ý</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              onClick={() => onOpen(r)}
              className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/30"
            >
              <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-foreground">{r.code ?? "—"}</td>
              {showKind && <td className="whitespace-nowrap px-4 py-3 text-xs font-medium">{r.kindLabel}</td>}
              <td className="max-w-[240px] truncate px-4 py-3 text-foreground" title={r.title}>
                {r.title}
              </td>
              <td className="max-w-[260px] px-4 py-3 text-xs">
                <span className="block truncate" title={r.partyA}>
                  <span className="text-muted-foreground">{r.partyALabel}:</span> {r.partyA}
                </span>
                <span className="block truncate" title={r.partyB}>
                  <span className="text-muted-foreground">{r.partyBLabel}:</span> {r.partyB}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                {r.value != null ? formatVnd(r.value) : "—"}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className={cn("whitespace-nowrap border-transparent font-medium", CONTRACT_TONE_CLASS[r.tone])}>
                  {r.statusLabel}
                </Badge>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                {r.signedAt ? format(new Date(r.signedAt), "dd/MM/yyyy") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
