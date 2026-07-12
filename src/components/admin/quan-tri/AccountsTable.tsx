import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { AdminAccount } from "@/types/adminRbac";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");

interface Props {
  accounts: AdminAccount[];
  isLoading: boolean;
  onView: (a: AdminAccount) => void;
}

export function AccountsTable({ accounts, isLoading, onView }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={TH}>Tài khoản</th>
              <th className={TH}>Trạng thái</th>
              <th className={TH}>Ngày tạo</th>
              <th className={`${TH} text-right`}>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  Chưa có tài khoản quản trị nào.
                </td>
              </tr>
            ) : (
              accounts.map((a) => (
                <tr
                  key={a.userId}
                  className="group cursor-pointer border-b border-border transition-colors hover:bg-muted/30"
                  onClick={() => onView(a)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground group-hover:underline">{a.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{a.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {a.lockStatus === "locked" ? (
                      <Badge variant="destructive">Bị khóa</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-success/10 text-success">Hoạt động</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(a.created_at)}</td>
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
