import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminOwnerSubscriptionList, useSetPlanWorkspaces } from "@/hooks/useAdminOwnerSubscriptions";
import type { OwnerSubPlan } from "@/lib/ownerSubscription/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: OwnerSubPlan | null;
}

/**
 * Chọn các Trạm (tổ chức chủ tài sản) được thấy và tự mua gói. Không chọn Trạm nào = gói
 * ẩn với chủ tài sản. Gỡ một Trạm không đụng gói đang chạy của Trạm đó, nhưng Trạm không
 * gia hạn / mua lại được gói này nữa.
 */
export function PlanWorkspacesDialog({ open, onOpenChange, plan }: Props) {
  const { data: rows, isLoading } = useAdminOwnerSubscriptionList();
  const save = useSetPlanWorkspaces();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelected(new Set(plan?.workspace_ids ?? []));
    setSearch("");
  }, [open, plan]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows ?? [];
    return (rows ?? []).filter((r) =>
      [r.workspace_name, r.owner_name, r.owner_email, r.parent_name].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const allFilteredOn = filtered.length > 0 && filtered.every((r) => selected.has(r.workspace_id));
  const usingPlan = (rows ?? []).filter((r) => plan && r.plan_id === plan.id && !selected.has(r.workspace_id));

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of filtered) {
        if (allFilteredOn) next.delete(r.workspace_id);
        else next.add(r.workspace_id);
      }
      return next;
    });

  const submit = () => {
    if (!plan) return;
    save.mutate({ planId: plan.id, workspaceIds: [...selected] }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Tổ chức được dùng gói {plan?.name}</DialogTitle>
          <DialogDescription>
            Chỉ tổ chức được chọn mới thấy gói này trên trang Gói dịch vụ và tự mua; admin cũng chỉ kích hoạt tay được cho các tổ chức này. Không chọn tổ chức nào = gói bị ẩn.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm tổ chức, Trưởng đơn vị…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={toggleFiltered} disabled={filtered.length === 0}>
            {allFilteredOn ? "Bỏ chọn" : "Chọn tất cả"}{search.trim() ? " (đang lọc)" : ""}
          </Button>
        </div>

        <div className="max-h-[22rem] overflow-y-auto rounded-xl border">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border-b px-3 py-2.5 last:border-b-0"><Skeleton className="h-5 w-full" /></div>
            ))}
          {!isLoading && filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Không có tổ chức nào khớp.</p>
          )}
          {filtered.map((r) => {
            const on = selected.has(r.workspace_id);
            return (
              <label
                key={r.workspace_id}
                className="flex cursor-pointer items-start gap-3 border-b px-3 py-2.5 last:border-b-0 hover:bg-muted/30"
              >
                <Checkbox className="mt-0.5" checked={on} onCheckedChange={(v) => toggle(r.workspace_id, v === true)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{r.workspace_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.owner_name || r.owner_email || "—"}
                    {r.parent_name ? ` · chi nhánh của ${r.parent_name}` : ""}
                    {r.plan_name ? ` · đang dùng ${r.plan_name}` : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {usingPlan.length > 0 && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-foreground">
            {usingPlan.length} tổ chức đang dùng gói này nhưng không được chọn ({usingPlan.map((r) => r.workspace_name).join(", ")}) — gói của họ vẫn chạy tới hết hạn nhưng không gia hạn được.
          </p>
        )}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-sm text-muted-foreground">Đã chọn {selected.size} tổ chức</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
            <Button onClick={submit} disabled={!plan || save.isPending}>
              {save.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Lưu
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
