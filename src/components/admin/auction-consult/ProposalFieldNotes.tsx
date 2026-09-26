import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PROPOSAL_NOTE_KEYS, PROPOSAL_NOTE_LABELS } from "@/lib/auctionConsult/labels";
import type { ProposalDraft, ProposalNoteKey } from "@/types/auctionConsult";

/** Lý giải chung + ghi chú từng tham số (người bán thấy ngay dưới tham số tương ứng). */
export function ProposalFieldNotes({
  draft,
  onChange,
  disabled,
}: {
  draft: ProposalDraft;
  onChange: (patch: Partial<ProposalDraft>) => void;
  disabled?: boolean;
}) {
  const keys = PROPOSAL_NOTE_KEYS.filter((k) => k !== "lot_duration" || draft.auction_format !== "truc_tiep");
  const setNote = (k: ProposalNoteKey, v: string) => onChange({ field_notes: { ...draft.field_notes, [k]: v } });
  const filled = keys.filter((k) => draft.field_notes[k]?.trim()).length;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="tvdg-rationale">Lý giải phương án</Label>
        <Textarea
          id="tvdg-rationale"
          rows={4}
          maxLength={4000}
          disabled={disabled}
          value={draft.rationale}
          placeholder="VD: Nhà mặt tiền Q10 thanh khoản tốt; đặt giá khởi điểm thấp hơn kỳ vọng 2% để hút người tham gia, bảo lưu tại mức kỳ vọng…"
          onChange={(e) => onChange({ rationale: e.target.value })}
        />
      </div>
      <details className="rounded-lg border border-border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Ghi chú từng tham số <span className="font-normal text-muted-foreground">({filled} mục)</span>
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {keys.map((k) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={`tvdg-note-${k}`} className="text-xs">
                {PROPOSAL_NOTE_LABELS[k]}
              </Label>
              <Textarea
                id={`tvdg-note-${k}`}
                rows={2}
                maxLength={1000}
                disabled={disabled}
                value={draft.field_notes[k] ?? ""}
                onChange={(e) => setNote(k, e.target.value)}
              />
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
