import { BellOff, BellRing, Eye, EyeOff, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContactConsentBadge } from "./ContactConsentBadge";
import { interestSummary } from "@/lib/orgContacts/interestLabel";
import type { OrgContactListRow } from "@/types/org-contacts";

interface Props {
  rows: OrgContactListRow[];
  isLoading: boolean;
  groupName: (id: string) => string | undefined;
  canEdit: boolean;
  canDelete: boolean;
  onOpen: (c: OrgContactListRow) => void;
  onEdit: (c: OrgContactListRow) => void;
  onDelete: (c: OrgContactListRow) => void;
  onToggleConsent: (c: OrgContactListRow) => void;
  onToggleStatus: (c: OrgContactListRow) => void;
}

export function ContactTable({
  rows, isLoading, groupName, canEdit, canDelete, onOpen, onEdit, onDelete, onToggleConsent, onToggleStatus,
}: Props) {
  if (isLoading) {
    return <div className="rounded-2xl border p-10 text-center text-sm text-muted-foreground">Đang tải danh bạ…</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Không có khách hàng nào khớp bộ lọc.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Khách hàng</TableHead>
            <TableHead>Liên hệ</TableHead>
            <TableHead className="min-w-[220px]">Nhu cầu</TableHead>
            <TableHead>Nhóm</TableHead>
            <TableHead>Nhận tin</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => {
            const [first, ...rest] = c.org_contact_interests;
            const groups = c.group_ids.map(groupName).filter(Boolean) as string[];
            return (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => onOpen(c)}>
                <TableCell>
                  <p className="font-medium text-foreground">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{c.code}</span>
                    {c.company_name ? ` · ${c.company_name}` : ""}
                    {c.province ? ` · ${c.province}` : ""}
                  </p>
                </TableCell>
                <TableCell className="text-sm">
                  {c.phone && <p>{c.phone}</p>}
                  {c.email && <p className="text-muted-foreground">{c.email}</p>}
                  {c.zalo && !c.phone && <p className="text-muted-foreground">Zalo: {c.zalo}</p>}
                </TableCell>
                <TableCell className="text-sm">
                  {first ? (
                    <>
                      <p className="line-clamp-2">{interestSummary(first)}</p>
                      {rest.length > 0 && <p className="text-xs text-muted-foreground">+{rest.length} nhu cầu khác</p>}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Chưa khai</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex max-w-[200px] flex-wrap gap-1">
                    {groups.slice(0, 2).map((g) => (
                      <Badge key={g} variant="secondary" className="font-normal">{g}</Badge>
                    ))}
                    {groups.length > 2 && <Badge variant="secondary">+{groups.length - 2}</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <ContactConsentBadge enabled={c.notifications_enabled} status={c.status} />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {(canEdit || canDelete) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Thao tác">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canEdit && (
                          <>
                            <DropdownMenuItem onClick={() => onEdit(c)}>
                              <Pencil className="mr-2 h-4 w-4" /> Sửa
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onToggleConsent(c)}>
                              {c.notifications_enabled ? (
                                <><BellOff className="mr-2 h-4 w-4" /> Ghi nhận ngừng nhận tin</>
                              ) : (
                                <><BellRing className="mr-2 h-4 w-4" /> Ghi nhận đồng ý nhận tin</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onToggleStatus(c)}>
                              {c.status === "active" ? (
                                <><EyeOff className="mr-2 h-4 w-4" /> Ngừng theo dõi</>
                              ) : (
                                <><Eye className="mr-2 h-4 w-4" /> Theo dõi lại</>
                              )}
                            </DropdownMenuItem>
                          </>
                        )}
                        {canDelete && (
                          <>
                            {canEdit && <DropdownMenuSeparator />}
                            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(c)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Xoá
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
