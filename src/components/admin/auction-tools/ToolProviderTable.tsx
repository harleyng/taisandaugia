import { Pencil, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProviderStatusBadge, OwnershipBadge } from "./ProviderStatusBadge";
import type { AuctionToolProvider } from "@/types/auctionTools";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";
const TD = "px-4 py-3 text-sm text-foreground align-middle";

interface Props {
  providers: AuctionToolProvider[];
  isLoading: boolean;
  onEdit: (p: AuctionToolProvider) => void;
  onDelete: (p: AuctionToolProvider) => void;
}

export function ToolProviderTable({ providers, isLoading, onEdit, onDelete }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <table className="w-full">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className={TH}>Đơn vị cung cấp</th>
            <th className={TH}>Phân loại</th>
            <th className={TH}>Dịch vụ / Đối tác</th>
            <th className={TH}>Trạng thái</th>
            <th className={`${TH} text-right`}>Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 5 }).map((__, j) => (
                  <td key={j} className={TD}><Skeleton className="h-4 w-24" /></td>
                ))}
              </tr>
            ))}

          {!isLoading && providers.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                Chưa có đơn vị cung cấp nào cho công cụ này.
              </td>
            </tr>
          )}

          {!isLoading &&
            providers.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className={TD}>
                  <div className="flex items-center gap-3">
                    {p.logo_url ? (
                      <img src={p.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs font-semibold text-muted-foreground">
                        {p.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">/{p.slug}</p>
                    </div>
                  </div>
                </td>
                <td className={TD}><OwnershipBadge isOwn={p.is_own} /></td>
                <td className={TD}>
                  <p className="text-sm">{p.service?.name ?? <span className="text-muted-foreground">Chưa gắn dịch vụ</span>}</p>
                  <p className="text-xs text-muted-foreground">{p.supplier?.name ?? "—"}</p>
                </td>
                <td className={TD}><ProviderStatusBadge status={p.status} /></td>
                <td className={`${TD} text-right`}>
                  <div className="flex items-center justify-end gap-1">
                    {p.website && (
                      <a href={p.website} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="icon"><ExternalLink className="h-4 w-4" /></Button>
                      </a>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => onEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(p)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
