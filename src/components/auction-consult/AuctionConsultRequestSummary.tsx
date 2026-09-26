import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Lock } from "lucide-react";
import { formatVnd } from "@/lib/advertising/slug";
import { saleGoalLabel } from "@/lib/auctionConsult/labels";
import {
  AUCTION_FORMAT_LABELS,
  EXPECTED_TIMELINE_LABELS,
  PRICING_MODE_LABELS,
  type AuctionFormat,
  type ExpectedTimeline,
  type PricingMode,
} from "@/types/asset-posting";
import type { AuctionConsultation } from "@/types/auctionConsult";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{children}</span>
    </div>
  );
}

/** Mục tiêu bán + bản chụp thông tin tài sản người bán gửi cho chuyên gia. */
export function AuctionConsultRequestSummary({ row }: { row: AuctionConsultation }) {
  const format_ = row.posting_auction_format as AuctionFormat | null;
  return (
    <div className="divide-y divide-dashed divide-border">
      <Row label="Mục tiêu bán">{saleGoalLabel(row.sale_goal)}</Row>
      <Row label="Giá mong muốn">{row.expected_price ? formatVnd(row.expected_price) : "—"}</Row>
      <Row label="Giá thấp nhất chấp nhận">
        {row.min_acceptable_price ? (
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3 w-3 text-muted-foreground" aria-label="Riêng tư" />
            {formatVnd(row.min_acceptable_price)}
          </span>
        ) : (
          "—"
        )}
      </Row>
      <Row label="Tiến độ">
        {row.desired_timeline ? EXPECTED_TIMELINE_LABELS[row.desired_timeline as ExpectedTimeline] : "—"}
        {row.sale_deadline && ` · hạn ${format(new Date(row.sale_deadline), "dd/MM/yyyy", { locale: vi })}`}
      </Row>
      <Row label="Tài sản lúc gửi">
        {[
          format_ ? AUCTION_FORMAT_LABELS[format_] : null,
          row.posting_pricing_mode === "appraisal"
            ? PRICING_MODE_LABELS[row.posting_pricing_mode as PricingMode]
            : row.posting_starting_price
              ? `giá ${formatVnd(row.posting_starting_price)}`
              : null,
          row.province,
        ]
          .filter(Boolean)
          .join(" · ") || "—"}
      </Row>
      {row.request_note && <p className="whitespace-pre-line pt-2 text-sm text-foreground">{row.request_note}</p>}
    </div>
  );
}
