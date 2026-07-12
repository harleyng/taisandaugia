import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { groupNumber } from "@/lib/advertising/slug";
import { accountStatus, type AdminUser } from "@/types/adminUser";
import { UserStatusBadge } from "./UserStatusBadge";

const TH = "px-4 py-2.5 text-left text-xs font-medium text-muted-foreground";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");

interface Props {
  users: AdminUser[];
  isLoading: boolean;
  onView: (u: AdminUser) => void;
}

export function UserTable({ users, isLoading, onView }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className={TH}>Người dùng</th>
              <th className={TH}>Vai trò</th>
              <th className={TH}>Trạng thái</th>
              <th className={TH}>Số dư</th>
              <th className={TH}>Đăng ký</th>
              <th className={`${TH} text-right`}>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                  Không có người dùng nào.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  className="group cursor-pointer border-b border-border transition-colors hover:bg-muted/30"
                  onClick={() => onView(u)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground group-hover:underline">{u.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.isAdmin ? "Admin" : "Người dùng"}</td>
                  <td className="px-4 py-3"><UserStatusBadge status={accountStatus(u)} /></td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium text-foreground">{groupNumber(u.balance)} CR</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(u.created_at)}</td>
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
