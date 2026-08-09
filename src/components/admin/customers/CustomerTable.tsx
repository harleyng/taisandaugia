import { BarChart3, Eye, MoreHorizontal, Pencil, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomerStatusBadge } from "./CustomerStatusBadge";
import { CUSTOMER_TYPE_LABELS } from "@/lib/customers/customerStatus";
import { segmentLabel } from "@/lib/customers/customerSegment";
import { formatVnd } from "@/lib/advertising/slug";
import {
  ENTITY_ROLE_LABELS, entityRole, prospectSubtypeLabel, type ProspectRow,
} from "@/lib/prospects/types";
import type { Customer } from "@/types/customers";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";
const THR = "px-4 py-2.5 text-right text-xs font-medium text-muted-foreground";

interface Props {
  customers: Customer[];
  isLoading: boolean;
  /** Số liệu tài sản tra theo `${prospect_kind}:${prospect_id}` — chỉ có với
   *  khách hàng gắn pháp nhân trên sàn. Dùng chung cache với danh sách lead. */
  prospectStats?: Record<string, ProspectRow>;
  canEdit?: boolean;
  canDelete?: boolean;
  onOpen: (c: Customer) => void;
  onOpenHistory: (c: Customer) => void;
  onEdit: (c: Customer) => void;
  onDelete: (c: Customer) => void;
}

export function CustomerTable({
  customers, isLoading, prospectStats, canEdit = true, canDelete = true,
  onOpen, onOpenHistory, onEdit, onDelete,
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
              <th className={TH}>Phân khúc</th>
              <th className={TH}>Loại hình</th>
              <th className={THR}>Tài sản</th>
              <th className={TH}>Trạng thái</th>
              <th className={THR}></th>
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
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  Chưa có khách hàng nào.
                </td>
              </tr>
            ) : (
              customers.map((c) => {
                const stat = c.prospect_id
                  ? prospectStats?.[`${c.prospect_kind}:${c.prospect_id}`]
                  : undefined;
                return (
                  <tr
                    key={c.id}
                    className="border-b border-border cursor-pointer transition-colors hover:bg-muted/60"
                    onClick={() => onOpen(c)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-xs text-primary">{c.code ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground inline-flex items-center gap-1.5">
                        {c.name}
                        {/* Đã gắn tài khoản sàn ⇒ tab Chiến dịch và đơn nạp
                            credit mới có dữ liệu. */}
                        {c.user_id && (
                          <UserRound
                            className="h-3.5 w-3.5 text-muted-foreground"
                            aria-label="Đã gắn tài khoản trên sàn"
                          />
                        )}
                      </span>
                      {stat?.parent_name && (
                        <span className="block text-[11px] text-muted-foreground">
                          Thuộc {stat.parent_name}
                        </span>
                      )}
                      {/* Nguồn gốc: mã lead đã chuyển đổi (customers.source_lead_id). */}
                      {c.source_lead && (
                        <span className="block text-[11px] text-green-700">
                          ← {c.source_lead.code ?? c.source_lead.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {c.contact_name || "—"}
                      {c.phone && <span className="block">{c.phone}</span>}
                      {c.email && <span className="block truncate max-w-[180px]">{c.email}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="text-foreground">{segmentLabel(c.segment)}</span>
                      <span className="block text-muted-foreground">
                        {CUSTOMER_TYPE_LABELS[c.customer_type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {stat ? (
                        <>
                          <span className="text-foreground">
                            {ENTITY_ROLE_LABELS[entityRole(stat.entity_type, stat.parent_id)]}
                          </span>
                          <span className="block text-muted-foreground">
                            {prospectSubtypeLabel(stat.subtype)}
                            {stat.branch_count > 0 && ` · ${stat.branch_count} chi nhánh`}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
                    <td className="px-4 py-3"><CustomerStatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {/* Hàng loạt thao tác dồn vào một menu — hành động chính là
                          bấm cả dòng để mở chi tiết. */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button size="icon" variant="ghost" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => onOpen(c)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Xem chi tiết
                          </DropdownMenuItem>
                          {c.prospect_id && (
                            <DropdownMenuItem onClick={() => onOpenHistory(c)}>
                              <BarChart3 className="h-4 w-4 mr-2" />
                              Tài sản đấu giá
                            </DropdownMenuItem>
                          )}
                          {canEdit && (
                            <DropdownMenuItem onClick={() => onEdit(c)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Sửa
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDelete(c)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Xóa
                              </DropdownMenuItem>
                            </>
                          )}
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
