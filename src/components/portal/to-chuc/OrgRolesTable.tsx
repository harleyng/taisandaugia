import { ChevronRight, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { OrgRoleWithMeta } from "@/types/orgRbac";

interface Props {
  roles: OrgRoleWithMeta[];
  isLoading: boolean;
  onView: (id: string) => void;
}

export function OrgRolesTable({ roles, isLoading, onView }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">Chưa có vai trò nào.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Vai trò</th>
            <th className="px-4 py-3 font-medium">Mô tả</th>
            <th className="px-4 py-3 font-medium whitespace-nowrap">Số quyền</th>
            <th className="px-4 py-3 font-medium whitespace-nowrap">Thành viên</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {roles.map((r) => (
            <tr
              key={r.id}
              onClick={() => onView(r.id)}
              className="cursor-pointer transition-colors hover:bg-muted/40"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{r.name}</span>
                  {r.is_system && (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheck className="h-3 w-3" /> Hệ thống
                    </Badge>
                  )}
                </div>
                <span className="font-mono text-xs text-muted-foreground">{r.code}</span>
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {r.description || <span className="text-muted-foreground/60">—</span>}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                {r.code === "OWNER" ? "Toàn quyền" : r.permissionCount}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                {r.memberCount}
              </td>
              <td className="px-4 py-3 text-right">
                <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
