import { ChevronRight, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { OWNER_TOTAL_PERMISSIONS } from "@/lib/ownerWorkspace/permissions";
import type { OwnerWsRoleRow } from "@/types/ownerRbac";

interface Props {
  roles: OwnerWsRoleRow[];
  /** Vai trò người xem đang giữ — gắn nhãn "Của bạn". */
  myRoleId: string | null;
  onView: (id: string) => void;
}

const GRID = "md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_1.5rem] md:items-center md:gap-4";

/** Danh sách vai trò của Trạm; dưới md thu thành các dòng xếp chồng. Bấm dòng mở chi tiết. */
export function OwnerRolesTable({ roles, myRoleId, onView }: Props) {
  return (
    <div className="text-sm">
      <div className={cn("hidden border-b pb-2 text-xs text-muted-foreground", GRID)}>
        <span>Vai trò</span>
        <span>Số quyền</span>
        <span>Thành viên</span>
        <span className="sr-only">Mở</span>
      </div>
      <ul className="divide-y">
        {roles.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onView(r.id)}
              className={cn(
                "flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-lg py-3 text-left transition-colors hover:bg-muted/40",
                GRID,
              )}
            >
              <span className="min-w-0 flex-1 basis-full md:basis-auto">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">{r.name}</span>
                  {r.isSystem && (
                    <Badge variant="outline" className="shrink-0 gap-1 border-primary/30 bg-primary/10 font-normal text-primary">
                      <ShieldCheck className="h-3 w-3" strokeWidth={1.5} /> Hệ thống
                    </Badge>
                  )}
                  {r.id === myRoleId && (
                    <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[11px] font-normal">
                      Của bạn
                    </Badge>
                  )}
                </span>
                {r.description && <span className="block truncate text-xs text-muted-foreground">{r.description}</span>}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {r.isSystem ? "Toàn quyền" : `${r.permissionCount}/${OWNER_TOTAL_PERMISSIONS} quyền`}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {r.memberCount} thành viên
                {r.inviteCount > 0 && <span className="text-xs"> · {r.inviteCount} lời mời</span>}
              </span>
              <ChevronRight className="hidden h-4 w-4 text-muted-foreground md:block" strokeWidth={1.5} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
