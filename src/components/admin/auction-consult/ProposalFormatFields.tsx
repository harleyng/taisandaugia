import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InfoBox } from "@/components/shared/InfoBox";
import { DURATION_PRESETS } from "@/lib/bidding/controlAccess";
import { BIDDING_METHOD_LABELS, isEngineSupportedMethod } from "@/lib/auctionConsult/labels";
import { AUCTION_FORMAT_LABELS, type AuctionFormat } from "@/types/asset-posting";
import type { ConsultBiddingMethod, ProposalDraft } from "@/types/auctionConsult";

interface Props {
  draft: ProposalDraft;
  onChange: (patch: Partial<ProposalDraft>) => void;
  disabled?: boolean;
}

const chip = (on: boolean) =>
  `inline-flex items-center gap-1.5 rounded-lg border-[1.5px] px-3 py-1.5 text-sm transition ${
    on ? "border-primary bg-primary/5 font-semibold text-primary" : "border-border hover:border-primary"
  }`;

/** Hình thức + phương thức trả giá + thời lượng lô của phương án. */
export function ProposalFormatFields({ draft, onChange, disabled }: Props) {
  const online = draft.auction_format !== "truc_tiep";
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Hình thức đấu giá</Label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(AUCTION_FORMAT_LABELS) as AuctionFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              disabled={disabled}
              className={chip(draft.auction_format === f)}
              onClick={() => onChange({ auction_format: f })}
            >
              {draft.auction_format === f && <Check className="h-3.5 w-3.5" />} {AUCTION_FORMAT_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tvdg-method">Phương thức trả giá</Label>
        <Select value={draft.bidding_method} onValueChange={(v) => onChange({ bidding_method: v })} disabled={disabled}>
          <SelectTrigger id="tvdg-method">
            <SelectValue placeholder="Chọn phương thức" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(BIDDING_METHOD_LABELS) as ConsultBiddingMethod[]).map((m) => (
              <SelectItem key={m} value={m}>
                {BIDDING_METHOD_LABELS[m]}
                {!isEngineSupportedMethod(m) && " (tham khảo)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {draft.bidding_method && !isEngineSupportedMethod(draft.bidding_method) && (
          <InfoBox variant="amber" className="text-xs">
            Sàn hiện chỉ chạy "Trả giá lên" — phương thức này chỉ để tham khảo, tổ chức không áp dụng trực tiếp được.
          </InfoBox>
        )}
      </div>

      {online && (
        <div className="space-y-2">
          <Label htmlFor="tvdg-duration">Thời lượng mỗi lô (phút)</Label>
          <div className="flex flex-wrap items-center gap-2">
            {DURATION_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={disabled}
                className={chip(draft.lot_duration_minutes === String(m))}
                onClick={() => onChange({ lot_duration_minutes: String(m) })}
              >
                {m} phút
              </button>
            ))}
            <Input
              id="tvdg-duration"
              inputMode="numeric"
              className="h-9 w-28"
              disabled={disabled}
              value={draft.lot_duration_minutes}
              placeholder="Tuỳ chỉnh"
              onChange={(e) => onChange({ lot_duration_minutes: e.target.value.replace(/[^\d]/g, "") })}
            />
          </div>
          <p className="text-xs text-muted-foreground">Từ 1 đến 1.440 phút — gợi ý cho tổ chức khi mở lô.</p>
        </div>
      )}
    </div>
  );
}
