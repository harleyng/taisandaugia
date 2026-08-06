import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { CpdActivityRole, CpdActivityType } from "@/types/cpd-catalog";
import { useCpdCatalogAdmin } from "@/hooks/useCpdCatalogAdmin";
import { ActivityTypeDialog } from "./ActivityTypeDialog";
import { ActivityRoleDialog } from "./ActivityRoleDialog";

/** Một dòng mô tả cách tính, viết ngắn để đọc lướt được cả bảng. */
function ruleText(m: "HOURS" | "FULL_YEAR", fixedHours?: number): string {
  if (m === "FULL_YEAR") return "Hoàn thành cả năm";
  return fixedHours != null ? `${fixedHours} giờ/lần` : "Nhập giờ thực tế";
}

interface Props {
  types: CpdActivityType[];
  canEdit: boolean;
}

export function ActivityTypeTable({ types, canEdit }: Props) {
  const { removeType, removeRole } = useCpdCatalogAdmin();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingType, setEditingType] = useState<CpdActivityType | undefined>();
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [roleCtx, setRoleCtx] = useState<
    { type: CpdActivityType; role?: CpdActivityRole } | null
  >(null);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openEdit = (t: CpdActivityType) => { setEditingType(t); setTypeDialogOpen(true); };
  const openCreate = () => { setEditingType(undefined); setTypeDialogOpen(true); };

  const nextSortOrder = (types.at(-1)?.sortOrder ?? 0) + 10;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Mỗi hình thức khai báo có phân vai trò hay không. Hình thức có vai trò
          thì cách tính giờ lấy từ vai trò, không lấy từ hình thức.
        </p>
        {canEdit && (
          <Button size="sm" className="shrink-0" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Thêm hình thức
          </Button>
        )}
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2.5">Hình thức</th>
              <th className="text-left font-medium px-3 py-2.5 hidden md:table-cell w-32">Mã</th>
              <th className="text-left font-medium px-3 py-2.5 w-44">Cách tính</th>
              <th className="text-left font-medium px-3 py-2.5 w-28">Trạng thái</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {types.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground text-xs">
                  Chưa có hình thức bồi dưỡng nào.
                </td>
              </tr>
            )}

            {types.map((t) => {
              const open = expanded.has(t.id);
              return [
                <tr key={t.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      {t.hasRoles ? (
                        <button
                          type="button"
                          onClick={() => toggle(t.id)}
                          className="mt-0.5 text-muted-foreground hover:text-foreground"
                          aria-label={open ? "Thu gọn vai trò" : "Xem vai trò"}
                        >
                          {open
                            ? <ChevronDown className="h-4 w-4" />
                            : <ChevronRight className="h-4 w-4" />}
                        </button>
                      ) : (
                        <span className="w-4" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium">{t.name}</p>
                        {t.legalBasis && (
                          <p className="text-xs text-muted-foreground mt-0.5">{t.legalBasis}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell">
                    <code className="text-xs text-muted-foreground">{t.code}</code>
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {t.hasRoles ? (
                      <span className="text-muted-foreground">
                        Theo vai trò ({t.roles.length})
                      </span>
                    ) : (
                      ruleText(t.creditMode, t.fixedHours)
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {t.isActive ? (
                      <Badge variant="secondary" className="font-normal text-xs">Đang dùng</Badge>
                    ) : (
                      <Badge variant="outline" className="font-normal text-xs text-muted-foreground">
                        Đã tắt
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => removeType.mutate(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>,

                ...(open && t.hasRoles ? [
                  <tr key={`${t.id}-roles`} className="bg-muted/20">
                    <td colSpan={5} className="px-3 py-2.5">
                      <div className="pl-6 space-y-1.5">
                        {t.roles.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            Chưa khai vai trò nào — hình thức này chưa dùng được vì
                            không biết tính giờ thế nào.
                          </p>
                        )}
                        {t.roles.map((r) => (
                          <div key={r.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm">
                                {r.name}
                                {!r.isActive && (
                                  <span className="text-xs text-muted-foreground"> · đã tắt</span>
                                )}
                              </p>
                              {r.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {ruleText(r.creditMode, r.fixedHours)}
                            </span>
                            {canEdit && (
                              <div className="shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setRoleCtx({ type: t, role: r })}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive"
                                  onClick={() => removeRole.mutate(r.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => setRoleCtx({ type: t })}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Thêm vai trò
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>,
                ] : []),
              ];
            })}
          </tbody>
        </table>
      </div>

      <ActivityTypeDialog
        open={typeDialogOpen}
        onOpenChange={setTypeDialogOpen}
        existing={editingType}
        nextSortOrder={nextSortOrder}
      />

      {roleCtx && (
        <ActivityRoleDialog
          open={!!roleCtx}
          onOpenChange={(o) => { if (!o) setRoleCtx(null); }}
          activityType={roleCtx.type}
          existing={roleCtx.role}
        />
      )}
    </div>
  );
}
