import { MoreHorizontal, UserCog, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { OwnerWorkspaceMember } from "@/hooks/useOwnerWorkspaceMembers";
import { OWNER_WS_ROLE_LABEL, type OwnerWsRole } from "@/lib/ownerWorkspace/roles";
import { scopeLabel } from "./scopeLabel";

interface Props {
  members: OwnerWorkspaceMember[];
  branchNames: ReadonlyMap<string, string>;
  currentUserId: string | null;
  /** Có quyền manage_members ⇒ hiện menu thao tác ở dòng của người khác. */
  canManage: boolean;
  onEdit: (member: OwnerWorkspaceMember) => void;
  onRemove: (member: OwnerWorkspaceMember) => void;
}

// Màu chỉ nằm ở viền nhãn nhỏ — Trưởng đơn vị nổi bằng primary, còn lại trung tính.
const ROLE_BADGE: Record<OwnerWsRole, string> = {
  owner: "border-primary/30 bg-primary/10 text-primary",
  staff: "border-border bg-muted text-foreground",
  viewer: "border-border bg-transparent text-muted-foreground",
};

const GRID = "md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_2.5rem] md:items-center md:gap-4";

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

/** Bảng thành viên; dưới md thu thành các dòng xếp chồng. */
export function OwnerMembersTable({ members, branchNames, currentUserId, canManage, onEdit, onRemove }: Props) {
  return (
    <div className="text-sm">
      <div className={cn("hidden border-b pb-2 text-xs text-muted-foreground", GRID)}>
        <span>Thành viên</span>
        <span>Vai trò</span>
        <span>Phạm vi</span>
        <span>Tham gia</span>
        <span className="sr-only">Thao tác</span>
      </div>

      <ul className="divide-y">
        {members.map((m) => {
          const isMe = m.userId === currentUserId;
          const scope = scopeLabel(m.role, m.branchScope, branchNames);
          return (
            <li key={m.memberId} className={cn("relative flex flex-wrap items-center gap-x-3 gap-y-1.5 py-3", GRID)}>
              <div className="min-w-0 flex-1 basis-full pr-10 md:basis-auto md:pr-0">
                <p className="flex items-center gap-2 truncate font-medium text-foreground">
                  <span className="truncate">{m.fullName || m.email}</span>
                  {isMe && (
                    <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[11px] font-normal">
                      Bạn
                    </Badge>
                  )}
                </p>
                {m.fullName && <p className="truncate text-xs text-muted-foreground">{m.email}</p>}
              </div>

              <div>
                <Badge variant="outline" className={cn("font-normal", ROLE_BADGE[m.role])}>
                  {OWNER_WS_ROLE_LABEL[m.role]}
                </Badge>
              </div>

              <p className="min-w-0 truncate text-muted-foreground" title={scope.detail}>
                {scope.text}
              </p>

              <p className="basis-full tabular-nums text-muted-foreground md:basis-auto">
                <span className="md:hidden">Tham gia </span>
                {formatDate(m.joinedAt)}
              </p>

              {/* Mobile: ghim góc phải dòng; desktop: cột cuối. */}
              <div className="absolute right-0 top-2 md:static md:justify-self-end">
                {canManage && !isMe && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Thao tác với ${m.fullName || m.email}`}
                        title="Thao tác"
                      >
                        <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(m)}>
                        <UserCog className="mr-2 h-4 w-4" strokeWidth={1.5} />
                        Đổi vai trò / phạm vi
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onRemove(m)}
                        className="text-destructive focus:text-destructive"
                      >
                        <UserMinus className="mr-2 h-4 w-4" strokeWidth={1.5} />
                        Gỡ khỏi không gian
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
