import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { EDIT_KIND_LABELS } from "@/lib/outreach/labels";
import type { OutreachEdit } from "@/types/outreach";

const when = (iso: string) => new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
const clip = (s: string | null) => (s ? (s.length > 140 ? `${s.slice(0, 139)}…` : s) : "∅");

/** Nhật ký một trường — mọi lần tạo / sửa / khôi phục đều có ở đây (ghi bởi RPC). */
export function FieldHistoryPopover({ edits }: { edits: OutreachEdit[] }) {
  const { userId } = useAuth();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground" disabled={!edits.length}>
          <History className="h-3.5 w-3.5" />
          Lịch sử ({edits.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-80 w-96 overflow-y-auto p-0">
        <ul className="divide-y text-xs">
          {edits.map((e) => (
            <li key={e.id} className="space-y-1 p-3">
              <div className="flex justify-between gap-2">
                <span className="font-medium text-foreground">{EDIT_KIND_LABELS[e.kind]}</span>
                <span className="text-muted-foreground">{when(e.created_at)}</span>
              </div>
              <p className="text-muted-foreground">
                {e.actor_id === userId ? "Bạn" : e.actor_id ? "Thành viên khác" : "Hệ thống"}
                {e.generator_label ? ` · ${e.generator_label}` : ""}
              </p>
              {e.kind !== "generate" && <p className="line-through opacity-70">{clip(e.old_value)}</p>}
              <p className="whitespace-pre-line text-foreground">{clip(e.new_value)}</p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
