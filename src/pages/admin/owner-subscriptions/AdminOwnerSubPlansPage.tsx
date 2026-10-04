import { useState } from "react";
import { Building2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHasAdminPermission } from "@/hooks/useAdminPermissions";
import { useAdminOwnerSubPlans } from "@/hooks/useAdminOwnerSubscriptions";
import { PlanFormDialog } from "@/components/admin/owner-subscriptions/PlanFormDialog";
import { PlanWorkspacesDialog } from "@/components/admin/owner-subscriptions/PlanWorkspacesDialog";
import { TermOptionsCard } from "@/components/admin/owner-subscriptions/TermOptionsCard";
import { PLAN_TIER_LABELS, planBenefitText, sortPlans } from "@/lib/ownerSubscription/catalog";
import type { OwnerSubPlan } from "@/lib/ownerSubscription/types";
import { formatMoneyFull } from "@/utils/money";

/** Tóm tắt các quyền lợi hệ thống kiểm (chặn / trừ credit khi hết). */
const quotaSummary = (p: OwnerSubPlan) =>
  p.benefits
    .filter((l) => l.benefit.source === "enforced")
    .map((l) => `${l.benefit.label}: ${planBenefitText(l)}`)
    .join(" · ");

/** /admin/goi-thue-bao/danh-muc — danh mục gói Trạm tự mua trên trang Gói dịch vụ. */
export default function AdminOwnerSubPlansPage() {
  const { data, isLoading } = useAdminOwnerSubPlans();
  const canCreate = useHasAdminPermission("goi-thue-bao", "create");
  const canUpdate = useHasAdminPermission("goi-thue-bao", "update");
  const [editing, setEditing] = useState<OwnerSubPlan | null>(null);
  const [open, setOpen] = useState(false);
  const [assigning, setAssigning] = useState<OwnerSubPlan | null>(null);

  const plans = sortPlans(data?.plans ?? []);
  const nextSort = plans.length ? Math.max(...plans.map((p) => p.sort_order)) + 1 : 1;

  const openForm = (plan: OwnerSubPlan | null) => {
    setEditing(plan);
    setOpen(true);
  };

  return (
    <div className="space-y-5 p-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Danh mục gói dịch vụ</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tạo gói rồi chọn tổ chức được dùng — chỉ tổ chức được chọn mới thấy gói trên trang Gói dịch vụ và tự mua. Sửa gói áp dụng từ lần mua / gia hạn sau.
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => openForm(null)}>
              <Plus className="mr-1.5 h-4 w-4" /> Thêm gói
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Gói</th>
                  <th className="px-4 py-3 font-medium">Hạn mức</th>
                  <th className="px-4 py-3 text-right font-medium">Giá / tháng</th>
                  <th className="px-4 py-3 font-medium">Dành cho</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Chưa có gói nào trong danh mục.</td>
                  </tr>
                )}
                {plans.map((p) => (
                  <tr key={p.id} className="border-t align-top">
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{p.sort_order}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {PLAN_TIER_LABELS[p.tier]} · {p.benefits.length} quyền lợi
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{quotaSummary(p) || "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatMoneyFull(p.monthly_price_vnd)}</td>
                    <td className="px-4 py-3">
                      {(p.workspace_ids?.length ?? 0) > 0 ? (
                        <span className="whitespace-nowrap text-foreground">{p.workspace_ids!.length} tổ chức</span>
                      ) : (
                        <span className="text-xs text-warning">Chưa chọn tổ chức — chủ tài sản không thấy gói</span>
                      )}
                      {canUpdate && (
                        <Button size="sm" variant="outline" className="mt-1.5 flex h-7 gap-1 px-2 text-xs" onClick={() => setAssigning(p)}>
                          <Building2 className="h-3.5 w-3.5" /> Chọn tổ chức
                        </Button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <span className={p.is_active ? "rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success" : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"}>
                          {p.is_active ? "Đang bán" : "Ngừng bán"}
                        </span>
                        {p.is_featured && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Phổ biến nhất</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      {canUpdate && (
                        <Button size="icon" variant="ghost" aria-label={`Sửa ${p.name}`} onClick={() => openForm(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TermOptionsCard terms={data?.terms ?? []} canEdit={canUpdate} />
        </>
      )}

      <PlanFormDialog open={open} onOpenChange={setOpen} plan={editing} nextSortOrder={nextSort} />
      <PlanWorkspacesDialog open={!!assigning} onOpenChange={(o) => !o && setAssigning(null)} plan={assigning} />
    </div>
  );
}
