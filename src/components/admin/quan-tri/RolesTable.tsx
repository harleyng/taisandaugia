import { ChevronRight, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { AdminRoleWithMeta } from "@/types/adminRbac";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";

interface Props {
  roles: AdminRoleWithMeta[];
  isLoading: boolean;
  onView: (r: AdminRoleWithMeta) => void;
}

export function RolesTable({ roles, isLoading, onView }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={TH}>Vai trò</th>
              <th className={TH}>Mô tả</th>
              <th className={TH}>Số quyền</th>
              <th className={TH}>Tài khoản</th>
              <th className={`${TH} text-right`}>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : roles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  Chưa có vai trò nào.
                </td>
              </tr>
            ) : (
              roles.map((r) => (
                <tr
                  key={r.id}
                  className="group cursor-pointer border-b border-border transition-colors hover:bg-muted/30"
                  onClick={() => onView(r)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground group-hover:underline">{r.name}</span>
                      {r.is_system && (
                        <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" /> Hệ thống</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{r.code}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{r.description || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-foreground">
                    {r.code === "SUPER_ADMIN" ? "Toàn quyền" : r.permissionCount}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{r.assignedCount}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-0.5 text-primary text-xs font-medium group-hover:underline">
                      Chi tiết <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
