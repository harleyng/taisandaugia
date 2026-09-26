import { useState } from "react";
import { usePostingCanWrite } from "@/components/asset-posting/postingAccess";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useDecideAuctionConsult } from "@/hooks/useAuctionConsultations";
import { decisionLabel } from "@/lib/auctionConsult/status";
import type { AuctionConsultation } from "@/types/auctionConsult";

export function DecisionBadge({ decision }: { decision: string }) {
  const cls =
    decision === "accepted"
      ? "bg-success/10 text-success"
      : decision === "declined"
        ? "bg-muted text-muted-foreground"
        : "bg-warning/15 text-warning";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {decisionLabel(decision)}
    </span>
  );
}

/**
 * Người bán Chấp nhận / Không sử dụng đề xuất hiện hành. Chấp nhận chỉ cho phép tổ chức đấu
 * giá xem đề xuất làm GỢI Ý khi lập phiên — không đổi cấu hình nào (BR-CNS-04).
 */
export function AuctionConsultDecisionBar({ row, mode }: { row: AuctionConsultation; mode: "owner" | "admin" }) {
  const decide = useDecideAuctionConsult();
  const [note, setNote] = useState(row.decision_note ?? "");
  const [editing, setEditing] = useState(false);
  const canWrite = usePostingCanWrite();
  const canDecide = mode === "owner" && canWrite && row.status === "completed";
  const decided = row.seller_decision !== "pending";

  const submit = (decision: "accepted" | "declined") =>
    decide.mutate(
      { consultationId: row.id, postingId: row.asset_posting_id, decision, note },
      { onSuccess: () => setEditing(false) },
    );

  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {row.status === "superseded" ? "Quyết định lúc đó:" : "Quyết định của người bán:"}
          </span>
          <DecisionBadge decision={row.seller_decision} />
          {row.decided_at && (
            <span className="text-xs text-muted-foreground">
              {format(new Date(row.decided_at), "HH:mm, dd/MM/yyyy", { locale: vi })}
            </span>
          )}
        </div>
        {canDecide && decided && !editing && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(true)}>
            Đổi quyết định
          </Button>
        )}
      </div>
      {row.decision_note && !editing && <p className="text-xs text-muted-foreground">Ghi chú: {row.decision_note}</p>}

      {canDecide && (!decided || editing) && (
        <div className="space-y-2">
          <Textarea
            rows={2}
            maxLength={1000}
            value={note}
            placeholder="Ghi chú (tuỳ chọn) — VD: dùng giá và bước giá, cọc để tổ chức đề xuất lại"
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={decide.isPending} onClick={() => submit("accepted")}>
              {decide.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
              Chấp nhận đề xuất
            </Button>
            <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => submit("declined")}>
              <X className="mr-1.5 h-3.5 w-3.5" /> Không sử dụng
            </Button>
            {editing && (
              <Button size="sm" variant="ghost" disabled={decide.isPending} onClick={() => setEditing(false)}>
                Thôi
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Chấp nhận: tổ chức đấu giá đã ký hợp đồng với bạn thấy đề xuất này làm gợi ý khi lập phiên và có thể dùng
            một phần. Cấu hình chính thức vẫn do tổ chức thực hiện ở bước Lập phiên.
          </p>
        </div>
      )}
    </div>
  );
}
