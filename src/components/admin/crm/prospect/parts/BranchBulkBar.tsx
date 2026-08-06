import { FolderPlus, Link2Off, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UNGROUPED_LABEL, type ProspectGroup } from "@/lib/prospects/types";

interface Props {
  count: number;
  groups: ProspectGroup[];
  busy: boolean;
  onClear: () => void;
  onAssignGroup: (groupId: string | null) => void;
  onCreateGroup: () => void;
  onDetachAll: () => void;
}

/** Thanh thao tác hàng loạt — chỉ hiện khi đang chọn dòng, thay vì chiếm chỗ
 *  thường trực bằng một hàng nút mờ. */
export function BranchBulkBar({
  count, groups, busy, onClear, onAssignGroup, onCreateGroup, onDetachAll,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
      <span className="text-sm text-foreground">
        Đang chọn <strong className="tabular-nums">{count}</strong> đơn vị
      </span>

      <div className="flex-1" />

      {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={busy}>
            <FolderPlus className="h-4 w-4 mr-1.5" />
            Xếp vào cụm
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Chọn cụm</DropdownMenuLabel>
          {groups.map((g) => (
            <DropdownMenuItem key={g.id} onClick={() => onAssignGroup(g.id)}>
              {g.name}
              <span className="ml-auto pl-3 text-xs text-muted-foreground">{g.unit_count}</span>
            </DropdownMenuItem>
          ))}
          {groups.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem onClick={onCreateGroup}>
            <FolderPlus className="h-4 w-4 mr-2" />
            Tạo cụm mới…
          </DropdownMenuItem>
          {groups.length > 0 && (
            <DropdownMenuItem onClick={() => onAssignGroup(null)}>
              Đưa về &quot;{UNGROUPED_LABEL}&quot;
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        className="text-destructive hover:text-destructive"
        onClick={onDetachAll}
      >
        <Link2Off className="h-4 w-4 mr-1.5" />
        Gỡ khỏi công ty mẹ
      </Button>

      <Button size="sm" variant="ghost" onClick={onClear} aria-label="Bỏ chọn">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
