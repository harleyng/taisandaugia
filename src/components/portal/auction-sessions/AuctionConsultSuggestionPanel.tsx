import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Lightbulb, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/advertising/slug";
import { biddingMethodLabel, isEngineSupportedMethod, PROPOSAL_NOTE_LABELS, PROPOSAL_NOTE_KEYS } from "@/lib/auctionConsult/labels";
import { suggestedLotValue, type LotApplicableField } from "@/lib/auctionConsult/suggestion";
import { AUCTION_FORMAT_LABELS, type AuctionFormat } from "@/types/asset-posting";
import type { AuctionConsultSuggestion, ProposalNoteKey } from "@/types/auctionConsult";

export type LotMoneyValues = Record<LotApplicableField, number | null>;

interface Props {
  suggestion: AuctionConsultSuggestion;
  /** Giá trị đang có trong form lô — nút "Áp dụng" tắt khi đã trùng. */
  currentValues: LotMoneyValues;
  sessionFormat?: string | null;
  onApply: (field: LotApplicableField, value: number) => void;
  /** Gọn cho danh sách nhiều lô trong hộp thoại thêm tài sản. */
  compact?: boolean;
}

const fmtFormat = (f: string | null) => (f ? (AUCTION_FORMAT_LABELS[f as AuctionFormat] ?? f) : "—");

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * Đề xuất tư vấn đấu giá mà chủ tài sản đã chấp nhận — GỢI Ý khi lập phiên (BR-CNS-06).
 * Không trường nào tự điền (BR-CNS-04): tổ chức bấm "Áp dụng" từng trường tiền của lô;
 * hình thức, phương thức, giá bảo lưu, thời lượng chỉ để tham khảo ở đây.
 */
export function AuctionConsultSuggestionPanel({ suggestion: s, currentValues, sessionFormat, onApply, compact }: Props) {
  const notes = (s.field_notes ?? {}) as Partial<Record<ProposalNoteKey, string>>;
  const noteKeys = PROPOSAL_NOTE_KEYS.filter((k) => notes[k]);
  const depositPreview =
    s.deposit_mode === "percent" ? `${Number(s.deposit_value)}% giá khởi điểm` : formatVnd(s.deposit_value);

  const applyRow = (field: LotApplicableField, label: string, shown: string, missingHint?: string) => {
    const value = suggestedLotValue(field, s, currentValues.starting_price);
    const same = value != null && currentValues[field] === value;
    return (
      <div className="flex items-center justify-between gap-2 py-1.5">
        <div className="min-w-0 text-sm">
          <span className="text-muted-foreground">{label}: </span>
          <span className="font-semibold text-foreground">{shown}</span>
          {field === "deposit_amount" && s.deposit_mode === "percent" && value != null && (
            <span className="text-muted-foreground"> ≈ {formatVnd(value)}</span>
          )}
          {value == null && missingHint && <p className="text-xs text-muted-foreground">{missingHint}</p>}
        </div>
        <Button
          type="button"
          size="sm"
          variant={same ? "ghost" : "outline"}
          className="h-7 shrink-0 px-2.5 text-xs"
          disabled={value == null || same}
          onClick={() => value != null && onApply(field, value)}
        >
          {same ? "Đang dùng" : "Áp dụng"}
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-start gap-2">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Đề xuất tư vấn v{s.version} <span className="font-mono text-xs font-normal text-muted-foreground">{s.code}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Chuyên gia {s.expert_name} ({s.partner_name})
            {s.decided_at && ` · chủ tài sản chấp nhận ${format(new Date(s.decided_at), "dd/MM/yyyy", { locale: vi })}`}
          </p>
        </div>
      </div>

      <div className="divide-y divide-dashed divide-primary/15">
        {applyRow("starting_price", "Giá khởi điểm", formatVnd(s.starting_price))}
        {applyRow("deposit_amount", "Tiền đặt trước", depositPreview, "Nhập giá khởi điểm trước để quy ra số tiền.")}
        {applyRow("bid_step", "Bước giá", formatVnd(s.bid_step))}
      </div>

      {!compact && (
        <div className="space-y-1 border-t border-primary/15 pt-2 text-xs text-muted-foreground">
          <p>
            Hình thức: <span className="font-medium text-foreground">{fmtFormat(s.auction_format)}</span>
            {sessionFormat && s.auction_format && s.auction_format !== sessionFormat && (
              <Tag>Khác phiên ({fmtFormat(sessionFormat)})</Tag>
            )}
            {" · "}Phương thức: <span className="font-medium text-foreground">{biddingMethodLabel(s.bidding_method)}</span>
            {!isEngineSupportedMethod(s.bidding_method) && <Tag>Chỉ tham khảo</Tag>}
          </p>
          <p>
            Giá bảo lưu:{" "}
            <span className="font-medium text-foreground">{s.reserve_price ? formatVnd(s.reserve_price) : "Không đặt"}</span>
            {s.reserve_price && (
              <Tag>
                <Lock className="h-2.5 w-2.5" /> Nội bộ, không lưu vào phiên
              </Tag>
            )}
          </p>
          {s.lot_duration_minutes && (
            <p>
              Thời lượng lô: <span className="font-medium text-foreground">{s.lot_duration_minutes} phút</span> — áp dụng khi
              Mở lô
            </p>
          )}
          {(s.rationale || noteKeys.length > 0) && (
            <details>
              <summary className="cursor-pointer font-medium text-foreground">Lý giải của chuyên gia</summary>
              {s.rationale && <p className="mt-1 whitespace-pre-line">{s.rationale}</p>}
              {noteKeys.map((k) => (
                <p key={k} className="mt-1">
                  <span className="font-medium text-foreground">{PROPOSAL_NOTE_LABELS[k]}:</span> {notes[k]}
                </p>
              ))}
            </details>
          )}
          <p className="pt-1">Không trường nào tự điền — tổ chức chọn dùng một phần hay toàn bộ đề xuất.</p>
        </div>
      )}
    </div>
  );
}
