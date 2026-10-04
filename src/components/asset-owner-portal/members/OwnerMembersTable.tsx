import { MoreHorizontal, Phone, UserCog, UserMinus } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import { scopeLabel } from "./scopeLabel";

interface Props {
  members: OwnerWorkspaceMember[];
  branchNames: ReadonlyMap<string, string>;
  currentUserId: string | null;
  /** thanh-vien:update ⇒ "Đổi vai trò / phạm vi" ở dòng của người khác. */
  canEdit: boolean;
  /** thanh-vien:delete ⇒ "Gỡ khỏi không gian". */
  canRemove: boolean;
  /** Người xem là Trưởng đơn vị — chỉ họ đụng được dòng Trưởng đơn vị. */
  viewerIsOwner: boolean;
  onEdit: (member: OwnerWorkspaceMember) => void;
  /** thanh-vien:update ⇒ bổ sung / sửa SĐT chưa xác thực của người khác. */
  onEditPhone: (member: OwnerWorkspaceMember) => void;
  onRemove: (member: OwnerWorkspaceMember) => void;
}

// Màu chỉ nằm ở viền nhãn nhỏ — Trưởng đơn vị nổi bằng primary, còn lại trung tính.
const OWNER_BADGE = "border-primary/30 bg-primary/10 text-primary";
const ROLE_BADGE = "border-border bg-muted text-foreground";

const GRID = "md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_2.5rem] md:items-center md:gap-4";

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

/** Bảng thành viên; dưới md thu thành các dòng xếp chồng. */
export function OwnerMembersTable({
  members,
  branchNames,
  currentUserId,
  canEdit,
  canRemove,
  viewerIsOwner,
  onEdit,
  onEditPhone,
  onRemove,
}: Props) {
  const navigate = useNavigate();
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
          const scope = scopeLabel(m.isOwner, m.branchScope, branchNames);
          const touchable = !isMe && (!m.isOwner || viewerIsOwner);
          const showEdit = canEdit && touchable;
          const showRemove = canRemove && touchable;
          const showPhone = showEdit && !m.phoneVerified;
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
                <MemberPhoneLine
                  phone={m.phone}
                  onAdd={showPhone ? () => onEditPhone(m) : isMe ? () => navigate("/profile") : undefined}
                  addLabel={isMe ? "Bổ sung ở Hồ sơ cá nhân" : "Bổ sung"}
                />
              </div>

              <div>
                <Badge variant="outline" className={cn("font-normal", m.isOwner ? OWNER_BADGE : ROLE_BADGE)}>
                  {m.roleName}
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
                {(showEdit || showPhone || showRemove) && (
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
                      {showEdit && (
                        <DropdownMenuItem onClick={() => onEdit(m)}>
                          <UserCog className="mr-2 h-4 w-4" strokeWidth={1.5} />
                          Đổi vai trò / phạm vi
                        </DropdownMenuItem>
                      )}
                      {showPhone && (
                        <DropdownMenuItem onClick={() => onEditPhone(m)}>
                          <Phone className="mr-2 h-4 w-4" strokeWidth={1.5} />
                          {m.phone ? "Sửa số điện thoại" : "Bổ sung số điện thoại"}
                        </DropdownMenuItem>
                      )}
                      {showRemove && (
                        <DropdownMenuItem
                          onClick={() => onRemove(m)}
                          className="text-destructive focus:text-destructive"
                        >
                          <UserMinus className="mr-2 h-4 w-4" strokeWidth={1.5} />
                          Gỡ khỏi không gian
                        </DropdownMenuItem>
                      )}
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

/** SĐT trong hồ sơ — chưa có thì gợi ý bổ sung (người có quyền / chính mình qua Hồ sơ cá nhân). */
function MemberPhoneLine({ phone, onAdd, addLabel }: { phone: string | null; onAdd?: () => void; addLabel: string }) {
  if (phone) return <p className="truncate text-xs tabular-nums text-muted-foreground">{phone}</p>;
  return (
    <p className="text-xs text-muted-foreground">
      Chưa có SĐT
      {onAdd && (
        <>
          {" · "}
          <button type="button" onClick={onAdd} className="font-medium text-primary hover:underline">
            {addLabel}
          </button>
        </>
      )}
    </p>
  );
}
