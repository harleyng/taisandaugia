import { ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DIRECT_METHOD_LABELS } from "@/lib/outreach/directMessage";
import { SEND_CHANNEL_LABELS } from "@/lib/outreach/labels";
import type { OutreachSend } from "@/types/outreach";

const when = (iso: string) => new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });

const sendTitle = (s: OutreachSend) =>
  s.channel
    ? `Đã đăng: ${SEND_CHANNEL_LABELS[s.channel]}`
    : `Liên hệ ${s.recipient_label ?? "khách đã xoá"} qua ${s.contact_method ? DIRECT_METHOD_LABELS[s.contact_method] : "—"}`;

/** Nhật ký gửi append-only — không sửa, không xoá. */
export function SendLogCard({ sends }: { sends: OutreachSend[] }) {
  const channels = sends.filter((s) => s.channel).length;
  const contacts = new Set(sends.filter((s) => s.contact_id).map((s) => s.contact_id)).size;

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <ClipboardList className="h-4 w-4" />
          Nhật ký gửi
        </h2>
        <p className="text-sm text-muted-foreground">
          {channels} lượt đăng kênh · {contacts} khách đã liên hệ. Nhật ký chỉ ghi thêm, không sửa hay xoá được.
        </p>
      </div>
      {sends.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa ghi nhận lượt gửi nào.</p>
      ) : (
        <ul className="divide-y rounded-xl border text-sm">
          {sends.map((s) => (
            <li key={s.id} className="p-3">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{sendTitle(s)}</span>
                  <span className="text-xs text-muted-foreground">{when(s.marked_at)}</span>
                </summary>
                {s.note && <p className="mt-2 text-xs text-muted-foreground">Ghi chú: {s.note}</p>}
                <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/30 p-2 font-sans text-xs">{s.text_snapshot}</pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
