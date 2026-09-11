import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrgChatInbox, type InboxFilter } from "@/hooks/useOrgChat";
import type { ChatChannel } from "@/types/case-qa";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";

/** Hộp thư: bộ lọc + danh sách hội thoại + luồng. Trạng thái giữ trên URL (?loc, ?kenh, ?c). */
export function InboxTab() {
  const [params, setParams] = useSearchParams();
  const filter: InboxFilter = params.get("loc") === "all" ? "all" : "attention";
  const rawChannel = params.get("kenh");
  const channel: ChatChannel | null = rawChannel === "zalo" || rawChannel === "marketplace" ? rawChannel : null;
  const selectedId = params.get("c");
  const { data: rows = [], isLoading } = useOrgChatInbox(filter, channel, null);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={filter === "attention" ? "default" : "outline"} onClick={() => setParam("loc", null)}>
          Cần xử lý
        </Button>
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setParam("loc", "all")}>
          Tất cả
        </Button>
        <Select value={channel ?? "all"} onValueChange={(v) => setParam("kenh", v === "all" ? null : v)}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Mọi kênh</SelectItem>
            <SelectItem value="marketplace">Sàn</SelectItem>
            <SelectItem value="zalo">Zalo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="rounded-2xl p-2">
          <ConversationList
            rows={rows}
            selectedId={selectedId}
            onSelect={(id) => setParam("c", id)}
            isLoading={isLoading}
            emptyText={filter === "attention" ? "Không còn hội thoại nào cần xử lý." : "Chưa có hội thoại nào."}
          />
        </Card>
        {selectedId ? (
          <ConversationThread key={selectedId} conversationId={selectedId} />
        ) : (
          <Card className="flex min-h-[320px] items-center justify-center rounded-2xl p-8 text-sm text-muted-foreground">
            Chọn một hội thoại để xem và trả lời.
          </Card>
        )}
      </div>
    </div>
  );
}
