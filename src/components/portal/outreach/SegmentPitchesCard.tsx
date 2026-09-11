import { MessageSquareQuote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { OutreachFieldEditor } from "./OutreachFieldEditor";
import { parseFieldKey, pitchFieldKey, type SegmentKey } from "@/lib/outreach/fieldKeys";
import type { AuctionSessionItem } from "@/types/auction-session";
import type { AudienceRow } from "@/types/org-contacts";
import type { OutreachEdit, OutreachField } from "@/types/outreach";

interface Props {
  sessionId: string;
  packId: string | null;
  audience: AudienceRow[];
  lots: AuctionSessionItem[];
  fieldsByKey: Map<string, OutreachField>;
  editsByKey: Map<string, OutreachEdit[]>;
  readOnly: boolean;
  canViewAudience: boolean;
}

/** Một câu chào / phân khúc. Phân khúc do truy vấn người nhận quyết định, không do trình soạn. */
export function SegmentPitchesCard({ sessionId, packId, audience, lots, fieldsByKey, editsByKey, readOnly, canViewAudience }: Props) {
  const counts = new Map<string, number>();
  for (const r of audience) if (r.eligible) counts.set(r.segment_key, (counts.get(r.segment_key) ?? 0) + 1);
  const segments = [...counts.keys()].sort() as SegmentKey[];
  const lotById = new Map(lots.map((l) => [l.id, l]));

  const segmentLabel = (seg: SegmentKey) => {
    if (seg === "multi") return "Khách khớp từ 2 lô trở lên";
    const lot = lotById.get(seg.slice(4));
    return lot ? `Khách chỉ khớp Lô ${lot.lot_no} — ${lot.title}` : "Lô đã gỡ khỏi phiên";
  };

  const orphaned = [...fieldsByKey.values()].filter((f) => {
    const parsed = parseFieldKey(f.field_key);
    return parsed?.kind === "pitch" && !counts.has(parsed.segment);
  });

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          <MessageSquareQuote className="h-4 w-4" />
          Câu chào theo phân khúc
        </h2>
        <p className="text-sm text-muted-foreground">
          Mỗi khách nhận câu chào của phân khúc mình kèm đúng các lô họ khớp. Thêm / gỡ lô hoặc đổi nhu cầu khách có thể
          làm đổi phân khúc — bấm "Soạn lại" để có câu chào cho phân khúc mới.
        </p>
      </div>

      {!canViewAudience ? (
        <p className="text-sm text-muted-foreground">Cần quyền xem danh bạ khách hàng để thấy phân khúc.</p>
      ) : segments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có khách đủ điều kiện gửi nên chưa có phân khúc nào.</p>
      ) : (
        <div className="space-y-4">
          {segments.map((seg) => {
            const key = pitchFieldKey(seg);
            return (
              <div key={seg} className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">
                  {segmentLabel(seg)} <span className="font-normal text-muted-foreground">· {counts.get(seg)} khách</span>
                </p>
                <OutreachFieldEditor
                  sessionId={sessionId}
                  packId={packId}
                  fieldKey={key}
                  field={fieldsByKey.get(key)}
                  edits={editsByKey.get(key) ?? []}
                  readOnly={readOnly}
                  rows={2}
                  placeholder="Một câu ngắn gửi riêng cho nhóm khách này"
                />
              </div>
            );
          })}
        </div>
      )}

      {orphaned.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            {orphaned.length} câu chào không còn áp dụng (giữ lại để đối chiếu nhật ký)
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {orphaned.map((f) => (
              <li key={f.id}>• {f.value}</li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}
