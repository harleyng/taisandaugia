import { useEffect, useState } from "react";
import { ChevronRight, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SubAdminHeader } from "@/components/admin/owner-subscriptions/SubAdminHeader";
import { ProvinceRolloutDialog } from "@/components/admin/province-rollout/ProvinceRolloutDialog";
import { ProvinceDetailPanel } from "@/components/admin/province-rollout/ProvinceDetailPanel";
import { useProvinceList } from "@/hooks/useProvinceRollout";
import { cn } from "@/lib/utils";

/**
 * /admin/goi-thue-bao/khoi-tao-tinh — công cụ triển khai một tỉnh (Phase 9 của
 * docs/owner-auction-planning-plan.md): tạo Trạm cấp tỉnh, mở một đơn vị cho mỗi
 * xã (mang mã hành chính chính thức), rồi mời cán bộ xã theo lô từ CSV.
 *
 * Nằm cùng nhóm với "Trạm đăng ký" vì đây chính là nơi danh sách Trạm chủ tài
 * sản đang sống; quyền dùng lại module `goi-thue-bao`.
 */
export default function AdminProvinceRolloutPage() {
  const { data: rows, isLoading } = useProvinceList();
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!selected && rows && rows.length > 0) setSelected(rows[0].workspace_id);
  }, [rows, selected]);

  const current = (rows ?? []).find((r) => r.workspace_id === selected) ?? null;

  return (
    <div>
      <SubAdminHeader
        section="rollout"
        title="Khởi tạo tỉnh"
        description="Bán cho tỉnh, triển khai xuống mọi xã trong một lần: một Trạm cấp tỉnh + một đơn vị cho mỗi xã, phường, đặc khu (gắn mã hành chính chính thức), rồi mời cán bộ từng xã theo lô. Có mã hành chính thì xã mới lập được kế hoạch đấu giá."
      />

      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Đang tải…"
              : `${(rows ?? []).length} tỉnh / thành phố đã khởi tạo`}
          </p>
          <Button onClick={() => setOpen(true)}>
            <MapPinned className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Khởi tạo tỉnh
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
          </div>
        ) : (rows ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              Chưa có tỉnh nào được khởi tạo. Bấm “Khởi tạo tỉnh” để tạo Trạm cấp tỉnh và mở đơn vị
              cho các xã.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <ul className="space-y-2">
              {(rows ?? []).map((r) => (
                <li key={r.workspace_id}>
                  <button
                    type="button"
                    onClick={() => setSelected(r.workspace_id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-2xl border p-4 text-left transition-colors",
                      r.workspace_id === selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.province_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.branch_count} xã · {r.member_count} thành viên · {r.plan_count} kế hoạch
                      </p>
                    </div>
                    {r.is_demo && <Badge variant="secondary">Minh hoạ</Badge>}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>

            {current && <ProvinceDetailPanel province={current} />}
          </div>
        )}
      </div>

      <ProvinceRolloutDialog
        open={open}
        onOpenChange={setOpen}
        onDone={(workspaceId) => setSelected(workspaceId)}
      />
    </div>
  );
}
