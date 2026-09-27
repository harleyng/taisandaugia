import { Fragment, useState } from "react";
import { format, parseISO } from "date-fns";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoneyShort } from "@/utils/money";
import {
  bestOf,
  depositLabel,
  estimatedCost,
  formatPct,
  orgSubLine,
} from "@/lib/consignment/ownerConsignmentView";
import { AUCTION_FORMAT_LABELS, type AssetPosting, type AuctionFormat } from "@/types/asset-posting";
import type { RequestWithOrg } from "@/hooks/useAssetPosting";
import { KgCard, KgOrg } from "./KgCard";
import { QuoteDocLink } from "./QuoteDocLink";
import { QuoteDetailsDialog } from "./QuoteDetailsDialog";

interface Fig {
  cost: number | null;
  pct: number | null;
  fee: number | null;
  price: number | null;
  format: AuctionFormat | null;
  days: number | null;
  deposit: string | null;
  valid: string | null;
}

type NumKey = "cost" | "pct" | "fee" | "price" | "days";

interface Row {
  key: keyof Fig;
  label: string;
  hint?: string;
  show: (f: Fig) => string;
  best?: "min" | "max";
}

const dash = (v: string | null | undefined) => v ?? "—";

const ROWS: Row[] = [
  {
    key: "cost",
    label: "Tổng chi phí ước tính",
    hint: "Thù lao × giá khởi điểm đề xuất + phí dịch vụ",
    show: (f) => (f.cost != null ? formatMoneyShort(f.cost) : "—"),
    best: "min",
  },
  { key: "pct", label: "Thù lao", show: (f) => (f.pct != null ? formatPct(f.pct) : "—"), best: "min" },
  { key: "fee", label: "Phí dịch vụ", show: (f) => (f.fee != null ? formatMoneyShort(f.fee) : "—"), best: "min" },
  {
    key: "price",
    label: "Giá khởi điểm đề xuất",
    show: (f) => (f.price != null ? formatMoneyShort(f.price) : "—"),
    best: "max",
  },
  { key: "format", label: "Hình thức", show: (f) => dash(f.format && AUCTION_FORMAT_LABELS[f.format]) },
  { key: "days", label: "Thời gian tổ chức", show: (f) => (f.days != null ? `${f.days} ngày` : "—"), best: "min" },
  { key: "deposit", label: "Tiền đặt trước", show: (f) => dash(f.deposit) },
  {
    key: "valid",
    label: "Hiệu lực báo giá",
    show: (f) => (f.valid ? `Đến ${format(parseISO(f.valid), "dd/MM/yyyy")}` : "—"),
  },
];

function figOf(q: RequestWithOrg, askPrice: number | null): Fig {
  return {
    cost: estimatedCost(q.quote_commission_pct, q.quote_service_fee, q.quote_starting_price ?? askPrice),
    pct: q.quote_commission_pct,
    fee: q.quote_service_fee,
    price: q.quote_starting_price,
    format: q.quote_plan?.auction_format ?? null,
    days: q.quote_lead_time_days,
    deposit: depositLabel(q.quote_plan),
    valid: q.quote_valid_until,
  };
}

const CHIP = "rounded-[5px] px-[5px] text-[11px] font-semibold not-italic leading-[17px]";

interface QuoteCompareCardProps {
  posting: AssetPosting;
  /** Yêu cầu đã có báo giá (quoted). */
  quotes: RequestWithOrg[];
  canPick: boolean;
  isPicking: boolean;
  onPick: (quote: RequestWithOrg) => void;
}

/** "N báo giá nhận được" — so từng tiêu chí giữa các tổ chức, chọn một nơi ký gửi. */
export function QuoteCompareCard({ posting, quotes, canPick, isPicking, onPick }: QuoteCompareCardProps) {
  const [detail, setDetail] = useState<RequestWithOrg | null>(null);
  const figs = quotes.map((q) => figOf(q, posting.starting_price));
  const today = format(new Date(), "yyyy-MM-dd");
  const best = (key: NumKey, dir: "min" | "max") => bestOf(figs.map((f) => f[key]), dir);
  const reopened = quotes.some((q) => q.reopened_at);

  const cell = "min-w-0 border-l border-t border-border px-3.5 py-[11px]";
  const labelCell = cn(cell, "border-l-0 bg-muted/30 text-[13px] text-foreground/70");

  return (
    <KgCard title={`${quotes.length} báo giá nhận được`} aux="So với yêu cầu của bạn">
      {reopened && (
        <p className="mb-3 flex items-start gap-1.5 rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Một số báo giá đã mở lại sau khi hợp đồng trước bị huỷ. Báo giá có thể đã cũ — hỏi lại tổ chức trước khi chọn.
        </p>
      )}

      <div className="overflow-x-auto rounded-[10px] border border-border">
        <div
          className="grid"
          role="table"
          aria-label="So sánh báo giá"
          style={{
            gridTemplateColumns: `minmax(150px,.9fr) repeat(${quotes.length},minmax(0,1fr))`,
            minWidth: 150 + quotes.length * 170,
          }}
        >
          <div className={cn(labelCell, "border-t-0 p-3.5")} role="columnheader" />
          {quotes.map((q) => (
            <div key={q.id} className={cn(cell, "border-t-0 p-3.5")} role="columnheader">
              <KgOrg
                name={q.org?.name ?? "Tổ chức đấu giá"}
                logoUrl={q.org?.logo_url}
                sub={orgSubLine(q.org?.province, q.quoted_at ? `báo giá ${format(new Date(q.quoted_at), "dd/MM")}` : null)}
              />
            </div>
          ))}

          {ROWS.map((row) => {
            const hl = row.key === "cost";
            const bestValue = row.best ? best(row.key as NumKey, row.best) : null;
            return (
              <Fragment key={row.key}>
                <div
                  role="rowheader"
                  className={cn(labelCell, hl && "bg-primary/5 font-semibold text-foreground")}
                >
                  {row.label}
                  {row.hint && <span className="mt-px block text-[11px] font-normal leading-[1.35] text-muted-foreground">{row.hint}</span>}
                </div>
                {figs.map((f, i) => {
                  const isBest = bestValue != null && f[row.key] === bestValue;
                  const over =
                    row.key === "pct" && f.pct != null && posting.commission_pct != null && f.pct > posting.commission_pct;
                  const diff = row.key === "format" && !!f.format && f.format !== posting.auction_format;
                  const expired = row.key === "valid" && !!f.valid && f.valid < today;
                  return (
                    <div
                      key={quotes[i].id}
                      role="cell"
                      className={cn(
                        cell,
                        "flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground",
                        hl && "bg-primary/5 text-lg font-bold tracking-[-0.01em]",
                      )}
                    >
                      <span className="tabular-nums">{row.show(f)}</span>
                      {isBest && (
                        <em
                          className={cn(
                            CHIP,
                            "text-success",
                            hl ? "border border-success/30 bg-card" : "bg-success/10",
                          )}
                        >
                          Tốt nhất
                        </em>
                      )}
                      {over && <em className={cn(CHIP, "bg-warning/15 text-foreground")}>Vượt mức {formatPct(posting.commission_pct!)}</em>}
                      {diff && <em className={cn(CHIP, "bg-warning/15 text-foreground")}>Khác yêu cầu</em>}
                      {expired && <em className={cn(CHIP, "bg-destructive/10 text-destructive")}>Hết hiệu lực</em>}
                    </div>
                  );
                })}
              </Fragment>
            );
          })}

          <div className={cn(labelCell)} />
          {quotes.map((q) => (
            <div key={q.id} className={cn(cell, "flex flex-col items-start gap-2.5 p-3.5")}>
              {canPick && q.status === "quoted" && (
                <Button className="w-full" disabled={isPicking} onClick={() => onPick(q)}>
                  Chọn tổ chức này
                </Button>
              )}
              {q.quote_doc_path && <QuoteDocLink path={q.quote_doc_path} />}
              {(q.quote_plan || (q.quote_fee_items?.length ?? 0) > 0 || q.quote_note) && (
                <button
                  type="button"
                  onClick={() => setDetail(q)}
                  className="text-[13px] font-semibold text-primary hover:underline"
                >
                  Chi tiết phương án
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[12.5px] text-muted-foreground">
        Chọn xong, các báo giá còn lại sẽ đóng và tổ chức được chọn bắt đầu soạn hợp đồng dịch vụ.
      </p>

      <QuoteDetailsDialog quote={detail} startingPrice={posting.starting_price} onOpenChange={(o) => !o && setDetail(null)} />
    </KgCard>
  );
}
