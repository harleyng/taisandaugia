import { Pencil, Trash2, ArrowUp, ArrowDown, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PartnerStatusBadge } from "./PartnerStatusBadge";
import type { Partner } from "@/types/partner";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";

interface Props {
  partners: Partner[];
  isLoading: boolean;
  onEdit: (p: Partner) => void;
  onDelete: (p: Partner) => void;
  /** Nhận danh sách đối tác theo thứ tự mới (sau khi ↑/↓). */
  onReorder: (ordered: Partner[]) => void;
  /** Cho phép đổi thứ tự (tắt khi đang lọc để không ghi sai thứ tự toàn cục). */
  reorderable: boolean;
}

export function PartnerTable({ partners, isLoading, onEdit, onDelete, onReorder, reorderable }: Props) {
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= partners.length) return;
    const next = [...partners];
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={`${TH} w-24`}>Thứ tự</th>
              <th className={TH}>Logo</th>
              <th className={TH}>Tên đối tác</th>
              <th className={TH}>Nhãn</th>
              <th className={TH}>Trạng thái</th>
              <th className={TH}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : partners.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">Chưa có đối tác nào.</td>
              </tr>
            ) : (
              partners.map((p, i) => (
                <tr
                  key={p.id}
                  className="group cursor-pointer border-b border-border transition-colors hover:bg-muted/30"
                  onClick={() => onEdit(p)}
                >
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    {reorderable ? (
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === 0} onClick={() => move(i, -1)}>
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i === partners.length - 1} onClick={() => move(i, 1)}>
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{p.sort_order}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.logo_url ? (
                      <img src={p.logo_url} alt={p.name} className="h-9 max-w-[96px] object-contain" />
                    ) : (
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded bg-muted text-muted-foreground">
                        <ImageIcon className="h-4 w-4" />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground group-hover:underline">
                    {p.name}
                    {p.tagline && <span className="block text-xs font-normal text-muted-foreground italic">{p.tagline}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{p.badge || "—"}</td>
                  <td className="px-4 py-3"><PartnerStatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(p)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(p)}>
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
