import { Fragment, useState } from "react";
import { ChevronRight, Pencil, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatVnd } from "@/lib/advertising/slug";
import { ServiceKindBadge, AudienceBadge } from "./ServiceKindBadge";
import { categoryLabel } from "./serviceLabels";
import type { Service, ServiceGroup, ServiceVariant } from "@/types/orders";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";

interface Props {
  groups: ServiceGroup[];
  isLoading: boolean;
  onEditGroup: (g: Service) => void;
  onDeleteGroup: (g: Service) => void;
  onAddVariant: (g: Service) => void;
  onEditVariant: (g: Service, v: ServiceVariant) => void;
  onDeleteVariant: (v: ServiceVariant) => void;
}

function variantPrice(v: ServiceVariant): string {
  if (v.price > 0) return formatVnd(v.price);
  if (v.credit_cost != null) return `${v.credit_cost.toLocaleString("vi-VN")} credit`;
  return "—";
}

export function ServiceGroupTable({
  groups,
  isLoading,
  onEditGroup,
  onDeleteGroup,
  onAddVariant,
  onEditVariant,
  onDeleteVariant,
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={`${TH} w-8`}></th>
              <th className={TH}>Nhóm dịch vụ</th>
              <th className={TH}>Nguồn</th>
              <th className={TH}>Đối tượng</th>
              <th className={TH}>Loại</th>
              <th className={`${TH} text-right`}>Biến thể</th>
              <th className={TH}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : groups.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground text-sm">Không có nhóm dịch vụ nào khớp bộ lọc.</td>
              </tr>
            ) : (
              groups.map((g) => {
                const expanded = open[g.id] ?? false;
                return (
                  <Fragment key={g.id}>
                    <tr className="group border-b border-border transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <button onClick={() => toggle(g.id)} aria-label={expanded ? "Thu gọn" : "Mở rộng"}>
                          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{g.name}</span>
                        {!g.is_active && <span className="ml-2 text-[11px] text-muted-foreground">(ẩn)</span>}
                        <span className="block font-mono text-[11px] text-muted-foreground/70">{g.code ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3"><ServiceKindBadge kind={g.kind} /></td>
                      <td className="px-4 py-3"><AudienceBadge audience={g.audience} /></td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{categoryLabel(g.category)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{g.variants.length}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-1">
                          {/* Nhóm credit VÀ hoa hồng đều có biến thể; chỉ 'direct'
                              (quảng cáo) là bán thẳng không qua biến thể. */}
                          {g.kind !== "direct" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Thêm biến thể" onClick={() => onAddVariant(g)}>
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditGroup(g)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDeleteGroup(g)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expanded &&
                      (g.variants.length === 0 ? (
                        <tr key={`${g.id}-empty`} className="border-b border-border bg-muted/20">
                          <td></td>
                          <td colSpan={6} className="px-4 py-2.5 text-xs text-muted-foreground">Chưa có biến thể.</td>
                        </tr>
                      ) : (
                        g.variants.map((v) => (
                          <tr key={v.id} className="border-b border-border bg-muted/20">
                            <td></td>
                            <td className="px-4 py-2.5">
                              <span className="text-sm text-foreground">{v.name}</span>
                              {v.is_popular && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Phổ biến</span>}
                              {v.is_best && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Tốt nhất</span>}
                              <span className="block font-mono text-[11px] text-muted-foreground/70">{v.variant_key}</span>
                            </td>
                            <td colSpan={2} className="px-4 py-2.5 text-sm tabular-nums text-foreground">{variantPrice(v)}</td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">
                              {v.price > 0 && v.credits != null ? `${v.credits.toLocaleString("vi-VN")} credit` : ""}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">#{v.sort_order}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditVariant(g, v)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDeleteVariant(v)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ))}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
