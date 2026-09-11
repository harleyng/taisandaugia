import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyButton } from "./CopyButton";
import { useMarkContacted } from "@/hooks/useSessionOutreach";
import { DIRECT_METHOD_LABELS, composeDirectMessage, type DirectMethod } from "@/lib/outreach/directMessage";
import type { OutreachInput } from "@/lib/outreach/outreachInput";
import type { AudienceRow } from "@/types/org-contacts";

interface Props {
  sessionId: string;
  packId: string | null;
  rows: AudienceRow[] | null;
  input: OutreachInput | null;
  pitchFor: (segmentKey: string) => string;
  onClose: () => void;
}

const reachOf = (r: AudienceRow, method: DirectMethod) =>
  method === "email" ? r.email : method === "zalo" ? r.zalo ?? r.phone : r.phone;

export function MarkContactedDialog({ sessionId, packId, rows, input, pitchFor, onClose }: Props) {
  const mark = useMarkContacted(sessionId);
  const [method, setMethod] = useState<DirectMethod>("zalo");
  useEffect(() => setMethod("zalo"), [rows]);

  const messages = useMemo(() => {
    if (!rows || !input) return [];
    const fallback = `${input.org.name} gửi anh/chị thông tin phiên đấu giá ${input.session.code ?? ""} có tài sản phù hợp nhu cầu.`;
    return rows.map((r) => {
      const pitch = pitchFor(r.segment_key).trim();
      return {
        row: r,
        missingPitch: !pitch,
        text: composeDirectMessage({
          method,
          contactName: r.full_name,
          pitch: pitch || fallback,
          lots: input.lots.filter((l) => r.matched_item_ids.includes(l.id)),
          session: input.session,
          org: input.org,
          publicUrl: input.publicUrl,
        }),
      };
    });
  }, [rows, input, method, pitchFor]);

  const noReach = messages.filter((m) => !reachOf(m.row, method)).length;
  const noPitch = messages.filter((m) => m.missingPitch).length;

  const confirm = () => {
    if (!packId) return;
    mark.mutate(
      {
        packId,
        contacts: messages.map((m) => ({ contact_id: m.row.contact_id, method, segment_key: m.row.segment_key, text: m.text })),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={!!rows} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ghi nhận đã liên hệ {rows?.length ?? 0} khách</DialogTitle>
          <DialogDescription>
            Sao chép từng tin để tự gửi, rồi xác nhận. Mỗi khách được lưu kèm đúng nội dung đã gửi. Chỉ khách còn đủ điều
            kiện trong danh sách người nhận mới được ghi nhận.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Cách liên hệ</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as DirectMethod)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(DIRECT_METHOD_LABELS) as DirectMethod[]).map((m) => (
                  <SelectItem key={m} value={m}>{DIRECT_METHOD_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">
            {noReach > 0 && <p className="text-warning">{noReach} khách chưa có thông tin cho cách liên hệ này.</p>}
            {noPitch > 0 && <p className="text-warning">{noPitch} khách thuộc phân khúc chưa có câu chào — dùng câu mặc định.</p>}
          </div>
        </div>

        <ul className="space-y-3">
          {messages.map((m) => (
            <li key={m.row.contact_id} className="space-y-2 rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium text-foreground">{m.row.full_name}</span>
                  <span className="text-muted-foreground"> · {reachOf(m.row, method) ?? "chưa có"}</span>
                </span>
                <CopyButton text={m.text} />
              </div>
              <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap font-sans text-xs text-muted-foreground">{m.text}</pre>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={confirm} disabled={!packId || !messages.length || mark.isPending}>
            {mark.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Xác nhận đã liên hệ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
