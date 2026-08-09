import { BarChart3, Eye, MoreHorizontal, Pencil, Trash2, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { SOURCE_LABELS, LEAD_TYPE_LABELS } from "@/lib/leads/leadStatus";
import { formatVnd } from "@/lib/advertising/slug";
import {
  ENTITY_ROLE_LABELS, entityRole, prospectSubtypeLabel, showSubtypeUnderRole,
  type ProspectRow,
} from "@/lib/prospects/types";
import type { Lead } from "@/types/leads";
import type { CustomerSegment } from "@/lib/customers/customerSegment";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";
const THR = "px-4 py-2.5 text-right text-xs font-medium text-muted-foreground";

interface Props {
  leads: Lead[];
  isLoading: boolean;
  /** Số liệu tài sản tra theo `${prospect_kind}:${prospect_id}` — chỉ có với
   *  lead nguồn dữ liệu sàn. */
  prospectStats?: Record<string, ProspectRow>;
  onOpen: (l: Lead) => void;
  onOpenHistory: (l: Lead) => void;
  onEdit: (l: Lead) => void;
  onConvert: (l: Lead) => void;
  onDelete: (l: Lead) => void;
}

export function LeadTable({
  leads, isLoading, prospectStats, onOpen, onOpenHistory, onEdit, onConvert, onDelete,
}: Props) {
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
              <th className={TH}>Loại hình</th>
              <th className={TH}>Nguồn</th>
              <th className={THR}>Tài sản</th>
              <th className={TH}>Trạng thái</th>
              <th className={THR}></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  Chưa có khách hàng tiềm năng nào.
                </td>
              </tr>
            ) : (
              leads.map((l) => {
                const converted = l.status === "converted";
                const stat = l.prospect_id
                  ? prospectStats?.[`${l.prospect_kind}:${l.prospect_id}`]
                  : undefined;
                return (
                  <tr
                    key={l.id}
                    className="border-b border-border cursor-pointer transition-colors hover:bg-muted/60"
                    onClick={() => onOpen(l)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs text-primary">{l.code ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{l.name}</span>
                      {l.company_name && l.company_name !== l.name && (
                        <span className="block text-xs text-muted-foreground">{l.company_name}</span>
                      )}
                      {/* Chi nhánh cũng là một prospect độc lập trong danh sách —
                          chỉ rõ công ty mẹ để khỏi đếm trùng khi rà khách hàng. */}
                      {stat?.parent_name && (
                        <span className="block text-[11px] text-muted-foreground">
                          Thuộc {stat.parent_name}
                        </span>
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
                    <td className="px-4 py-3 text-xs">
                      {stat ? (
                        (() => {
                          const role = entityRole(stat.entity_type, stat.parent_id);
                          // Dòng phụ chỉ hiện khi thật sự thêm thông tin — xem
                          // showSubtypeUnderRole.
                          const sub = showSubtypeUnderRole(role, stat.subtype)
                            ? prospectSubtypeLabel(stat.subtype)
                            : null;
                          const branches =
                            stat.branch_count > 0 ? `${stat.branch_count} chi nhánh` : null;
                          return (
                            <>
                              <span className="text-foreground whitespace-nowrap">
                                {ENTITY_ROLE_LABELS[role]}
                              </span>
                              {(sub || branches) && (
                                <span className="block text-muted-foreground">
                                  {[sub, branches].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </>
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {SOURCE_LABELS[l.source] ?? l.source}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {stat ? (
                        <>
                          <span className="tabular-nums font-medium text-foreground">
                            {stat.total_listings}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {formatVnd(stat.total_starting_price)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><LeadStatusBadge status={l.status} /></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {/* Hàng loạt thao tác dồn vào một menu — hàng động chính là
                          bấm cả dòng để mở chi tiết. */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => onOpen(l)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Xem chi tiết
                          </DropdownMenuItem>
                          {l.prospect_id && (
                            <DropdownMenuItem onClick={() => onOpenHistory(l)}>
                              <BarChart3 className="h-4 w-4 mr-2" />
                              Tài sản đấu giá
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onEdit(l)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Sửa
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={converted} onClick={() => onConvert(l)}>
                            <UserCheck className="h-4 w-4 mr-2" />
                            Chuyển thành khách hàng
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onDelete(l)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Xóa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
