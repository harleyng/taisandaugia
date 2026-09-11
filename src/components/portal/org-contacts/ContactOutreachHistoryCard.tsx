import { useNavigate } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useContactOutreachHistory } from "@/hooks/useSessionOutreach";
import { DIRECT_METHOD_LABELS } from "@/lib/outreach/directMessage";

const when = (iso: string) => new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

/** Những lần tổ chức đã liên hệ khách này khi tiếp thị phiên (từ nhật ký gửi). */
export function ContactOutreachHistoryCard({ contactId }: { contactId: string }) {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useContactOutreachHistory(contactId);

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="font-semibold text-foreground">Lịch sử tiếp thị</h2>
        <p className="text-sm text-muted-foreground">Các lần đã liên hệ khách này về phiên đấu giá, kèm nội dung đã gửi.</p>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          <Megaphone className="mx-auto mb-2 h-6 w-6" />
          Chưa liên hệ khách này trong phiên nào.
        </div>
      ) : (
        <ul className="divide-y rounded-xl border text-sm">
          {rows.map((r) => {
            const session = r.session_outreach_packs?.auction_sessions;
            const sessionId = r.session_outreach_packs?.session_id;
            return (
              <li key={r.id} className="space-y-1 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="text-left font-medium text-primary hover:underline"
                    onClick={() => sessionId && navigate(`/portal/phien-dau-gia/${sessionId}/tiep-thi`)}
                  >
                    {session ? `${session.code ?? ""} · ${session.title}` : "Phiên đã xoá"}
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {r.contact_method ? DIRECT_METHOD_LABELS[r.contact_method] : ""} · {when(r.marked_at)}
                  </span>
                </div>
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground">Nội dung đã gửi</summary>
                  <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/30 p-2 font-sans text-xs">{r.text_snapshot}</pre>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
