import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilePlus2, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrgCaseEscalations } from "@/hooks/useCaseEscalations";
import { useHasOrgPermission } from "@/hooks/useOrgPermissions";
import { formatShortDateTime } from "@/lib/caseQa/formatVn";
import { ESCALATION_REASON_LABELS, ESCALATION_STATUS_LABELS } from "@/lib/caseQa/labels";
import type { EscalationStatus } from "@/types/case-qa";
import type { CaseEscalation } from "@/types/case-chat";
import { AddClarificationDialog } from "./AddClarificationDialog";
import { ChannelBadge } from "./ChannelBadge";
import { ResolveEscalationDialog } from "./ResolveEscalationDialog";

const FILTERS: (EscalationStatus | "all")[] = ["open", "added_to_case", "dismissed", "all"];

/** Sổ câu hỏi chuyển tiếp — tách biệt với việc đã trả lời người hỏi trong hộp thư. */
export function EscalationsTab() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<EscalationStatus | "all">("open");
  const { data = [], isLoading } = useOrgCaseEscalations(status);
  const canUpdate = useHasOrgPermission("hoi-dap", "update");
  const canEditCase = useHasOrgPermission("phien-dau-gia", "update");
  const [adding, setAdding] = useState<CaseEscalation | null>(null);
  const [resolving, setResolving] = useState<CaseEscalation | null>(null);

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="font-semibold text-foreground">Sổ câu hỏi chuyển tiếp</h2>
        <p className="text-xs text-muted-foreground">
          Câu hỏi AI không trả lời được từ tài liệu phiên. Bổ sung vào tài liệu để lần sau AI trả lời được — việc này tách
          biệt với việc trả lời người hỏi trong hộp thư.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button key={f} size="sm" variant={status === f ? "default" : "outline"} onClick={() => setStatus(f)}>
            {f === "all" ? "Tất cả" : ESCALATION_STATUS_LABELS[f]}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : data.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Không có câu hỏi nào ở mục này.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.map((e) => (
            <li key={e.id} className="space-y-2 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">“{e.question}”</p>
                <Badge variant="outline" className="shrink-0 text-[11px]">
                  {ESCALATION_STATUS_LABELS[e.status]}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <ChannelBadge channel={e.channel} simulated={e.chat_conversations?.is_simulated} />
                <span>{e.chat_conversations?.contact_name}</span>
                {e.auction_sessions && (
                  <span>
                    · <span className="font-mono">{e.auction_sessions.code}</span> {e.auction_sessions.title}
                  </span>
                )}
                <span>· {formatShortDateTime(e.created_at)}</span>
              </div>
              <p className="text-xs text-amber-700">Lý do: {ESCALATION_REASON_LABELS[e.reason]}</p>
              {e.resolution_note && <p className="text-xs text-muted-foreground">Ghi chú: {e.resolution_note}</p>}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => navigate(`/portal/hoi-dap?tab=hop-thu&loc=all&c=${e.conversation_id}`)}
                >
                  <MessageSquare className="h-4 w-4" />
                  Xem hội thoại
                </Button>
                {canEditCase && e.status === "open" && e.session_id && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAdding(e)}>
                    <FilePlus2 className="h-4 w-4" />
                    Bổ sung tài liệu phiên
                  </Button>
                )}
                {canUpdate && (
                  <Button variant="outline" size="sm" onClick={() => setResolving(e)}>
                    {e.status === "open" ? "Đánh dấu đã xử lý" : "Mở lại"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && <AddClarificationDialog escalation={adding} onClose={() => setAdding(null)} />}
      {resolving && <ResolveEscalationDialog escalation={resolving} onClose={() => setResolving(null)} />}
    </Card>
  );
}
