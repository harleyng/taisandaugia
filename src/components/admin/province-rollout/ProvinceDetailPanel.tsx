import { useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BulkInviteDialog } from "@/components/admin/province-rollout/BulkInviteDialog";
import { inviteUrl } from "@/lib/provinceRollout/links";
import { ProvinceRolloutDialog } from "@/components/admin/province-rollout/ProvinceRolloutDialog";
import {
  useProvinceInvites,
  useProvinceUnits,
  type ProvinceRow,
} from "@/hooks/useProvinceRollout";
import { INVITE_ROLE_LABELS, type InviteRole } from "@/lib/provinceRollout/csv";

/** Chi tiết một tỉnh đã khởi tạo: danh sách xã + lời mời đang chờ. */
export function ProvinceDetailPanel({ province }: { province: ProvinceRow }) {
  const { data: units, isLoading } = useProvinceUnits(province.workspace_id);
  const { data: invites } = useProvinceInvites(province.workspace_id);
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{province.workspace_name}</h2>
          <p className="text-sm text-muted-foreground">
            {province.province_name} · mã {province.admin_unit_code} · {province.branch_count} đơn vị
            cấp xã · {province.plan_count} kế hoạch
            {province.owner_email && ` · Trưởng đơn vị ${province.owner_email}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Bổ sung đơn vị
          </Button>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Mời cán bộ theo lô
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Đơn vị cấp xã</th>
              <th className="px-4 py-2.5 text-left font-medium">Mã</th>
              <th className="px-4 py-2.5 text-right font-medium">Thành viên</th>
              <th className="px-4 py-2.5 text-right font-medium">Lời mời chờ</th>
              <th className="px-4 py-2.5 text-right font-medium">Kế hoạch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-4">
                  <Skeleton className="h-5 w-full" />
                </td>
              </tr>
            ) : (units ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Tỉnh này chưa có đơn vị cấp xã nào.
                </td>
              </tr>
            ) : (
              (units ?? []).map((u) => (
                <tr key={u.branch_id}>
                  <td className="px-4 py-2.5">
                    {u.display_name ?? u.unit_name ?? "—"}
                    {!u.is_active && (
                      <Badge variant="outline" className="ml-2">
                        Tạm dừng
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {u.admin_unit_code}
                  </td>
                  <td className="px-4 py-2.5 text-right">{u.member_count}</td>
                  <td className="px-4 py-2.5 text-right">{u.invite_count}</td>
                  <td className="px-4 py-2.5 text-right">{u.plan_count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(invites ?? []).length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-2.5 text-sm font-medium">
            Lời mời đang chờ ({invites!.length})
          </div>
          <ul className="divide-y divide-border">
            {invites!.map((i) => (
              <li key={i.invite_id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <span className="flex-1 truncate">{i.email}</span>
                <span className="text-muted-foreground">{i.unit_name ?? i.admin_unit_code}</span>
                <Badge variant="secondary">
                  {INVITE_ROLE_LABELS[i.role as InviteRole] ?? i.role}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(inviteUrl(i.token));
                    toast.success("Đã copy link lời mời.");
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy link
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ProvinceRolloutDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        preset={{
          workspaceId: province.workspace_id,
          provinceCode: province.admin_unit_code,
          existing: (units ?? []).map((u) => u.admin_unit_code),
        }}
      />
      <BulkInviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        workspaceId={province.workspace_id}
        workspaceName={province.workspace_name}
      />
    </div>
  );
}

export function ProvinceDetailSkeleton() {
  return (
    <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-10">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  );
}
