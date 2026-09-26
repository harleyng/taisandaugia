import { AlertTriangle, Lock } from "lucide-react";
import { formatVnd } from "@/lib/advertising/slug";
import { biddingMethodLabel, isEngineSupportedMethod } from "@/lib/auctionConsult/labels";
import { bidStepPercent, depositVnd, depositWarning } from "@/lib/auctionConsult/proposal";
import { AUCTION_FORMAT_LABELS, type AuctionFormat } from "@/types/asset-posting";
import type { AuctionConsultProposal, ProposalNoteKey } from "@/types/auctionConsult";

type ProposalFields = Pick<
  AuctionConsultProposal,
  | "auction_format"
  | "bidding_method"
  | "starting_price"
  | "reserve_price"
  | "bid_step"
  | "lot_duration_minutes"
  | "deposit_mode"
  | "deposit_value"
  | "rationale"
  | "field_notes"
>;

function Badge({ tone, children }: { tone: "muted" | "warn"; children: React.ReactNode }) {
  return (
    <span
      className={`ml-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        tone === "warn" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}

function Param({ label, value, note, extra }: { label: string; value: React.ReactNode; note?: string; extra?: React.ReactNode }) {
  return (
    <div className="space-y-0.5 py-2 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
        <span className="text-right text-sm font-semibold text-foreground">{value}</span>
      </div>
      {extra}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

/** Đầy đủ tham số của một phương án tư vấn (AC: người bán xem được đầy đủ tham số đề xuất). */
export function AuctionConsultProposalView({ proposal: p }: { proposal: ProposalFields }) {
  const notes = (p.field_notes ?? {}) as Partial<Record<ProposalNoteKey, string>>;
  const start = p.starting_price == null ? null : Number(p.starting_price);
  const depVal = p.deposit_value == null ? null : Number(p.deposit_value);
  const depVnd = depositVnd(p.deposit_mode, depVal, start);
  const depWarn = depositWarning(p.deposit_mode, depVal, start);
  const stepPct = bidStepPercent(p.bid_step == null ? null : Number(p.bid_step), start);

  return (
    <div className="space-y-3">
      <div className="divide-y divide-dashed divide-border">
        <Param
          label="Hình thức"
          value={p.auction_format ? (AUCTION_FORMAT_LABELS[p.auction_format as AuctionFormat] ?? p.auction_format) : "—"}
          note={notes.auction_format}
        />
        <Param
          label="Phương thức trả giá"
          value={
            <>
              {biddingMethodLabel(p.bidding_method)}
              {p.bidding_method && !isEngineSupportedMethod(p.bidding_method) && <Badge tone="muted">Chỉ tham khảo</Badge>}
            </>
          }
          note={notes.bidding_method}
        />
        <Param label="Giá khởi điểm" value={start ? formatVnd(start) : "—"} note={notes.starting_price} />
        <Param
          label="Giá bảo lưu"
          value={
            p.reserve_price ? (
              <>
                {formatVnd(p.reserve_price)}
                <Badge tone="muted">
                  <Lock className="h-2.5 w-2.5" /> Riêng tư
                </Badge>
              </>
            ) : (
              "Không đặt"
            )
          }
          note={notes.reserve_price}
        />
        <Param
          label="Bước giá"
          value={
            p.bid_step ? (
              <>
                {formatVnd(p.bid_step)}
                {stepPct != null && <span className="font-normal text-muted-foreground"> ({stepPct}%)</span>}
              </>
            ) : (
              "—"
            )
          }
          note={notes.bid_step}
        />
        {p.auction_format !== "truc_tiep" && (
          <Param
            label="Thời lượng mỗi lô"
            value={p.lot_duration_minutes ? `${p.lot_duration_minutes} phút` : "—"}
            note={notes.lot_duration}
          />
        )}
        <Param
          label="Tiền đặt trước"
          value={
            p.deposit_mode === "percent" ? (
              <>
                {Number(p.deposit_value)}%
                {depVnd != null && <span className="font-normal text-muted-foreground"> ≈ {formatVnd(depVnd)}</span>}
              </>
            ) : depVal != null ? (
              formatVnd(depVal)
            ) : (
              "—"
            )
          }
          extra={
            depWarn && (
              <p className="flex items-center justify-end gap-1 text-xs text-warning">
                <AlertTriangle className="h-3 w-3" /> {depWarn}
              </p>
            )
          }
          note={notes.deposit}
        />
      </div>
      {p.rationale && (
        <div className="rounded-lg bg-muted/40 p-2.5">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Lý giải của chuyên gia</p>
          <p className="whitespace-pre-line text-sm text-foreground">{p.rationale}</p>
        </div>
      )}
    </div>
  );
}
