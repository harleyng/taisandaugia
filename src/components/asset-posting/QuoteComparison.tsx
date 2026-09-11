import { useEffect, useState } from "react";
import { AlertTriangle, Building2, Check, ChevronDown, Clock, Download, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatVnd } from "@/lib/advertising/slug";
import { signQuoteDoc } from "@/hooks/useOrgServiceRequests";
import { QuoteDetails } from "@/components/consignment/QuoteDetails";
import { AUCTION_FORMAT_LABELS, type AuctionFormat } from "@/types/asset-posting";
import type { RequestWithOrg } from "@/hooks/useAssetPosting";

interface QuoteComparisonProps {
  /** Chỉ những yêu cầu ĐÃ có báo giá (status 'quoted') hoặc đã chốt. */
  quotes: RequestWithOrg[];
  /** Thù lao chủ tài sản khai là chấp nhận được — để đối chiếu. */
  acceptableCommissionPct?: number | null;
  /** Hình thức đấu giá chủ tài sản mong muốn — cảnh báo khi tổ chức đề xuất khác. */
  requestedAuctionFormat?: string | null;
  /** Giá khởi điểm của hồ sơ — để quy tiền đặt trước theo % ra VNĐ. */
  startingPrice?: number | null;
  /** Mở bước xác nhận cho báo giá này — KHÔNG chốt ngay. */
  onSelect: (quote: RequestWithOrg) => void;
  isSelecting: boolean;
  /** Đã chốt xong: khoá nút chọn, chỉ còn xem lại. */
  decided: boolean;
}

function QuoteDocLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    signQuoteDoc(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path]);

  return (
    <Button
      variant="link"
      size="sm"
      className="h-auto gap-1.5 p-0 text-xs"
      disabled={!url}
      onClick={() => url && window.open(url, "_blank", "noopener")}
    >
      <Download className="h-3.5 w-3.5" />
      {url ? "Tải tệp báo giá" : "Đang tạo liên kết…"}
    </Button>
  );
}

/**
 * So sánh báo giá của các tổ chức và chọn một nơi ký gửi.
 *
 * Chọn xong là cam kết: RPC đóng mọi báo giá còn lại thành 'not_selected' và
 * mở một cơ hội trong CRM — nên nút ở đây chỉ mở hộp thoại xác nhận.
 */
export function QuoteComparison({
  quotes,
  acceptableCommissionPct,
  requestedAuctionFormat,
  startingPrice,
  onSelect,
  isSelecting,
  decided,
}: QuoteComparisonProps) {
  if (quotes.length === 0) return null;

  return (
    <div className="space-y-3">
      {quotes.map((q) => {
        const chosen = q.status === "selected";
        const overBudget =
          acceptableCommissionPct != null &&
          q.quote_commission_pct != null &&
          q.quote_commission_pct > acceptableCommissionPct;
        const proposedFormat = q.quote_plan?.auction_format ?? null;
        const formatMismatch =
          !!proposedFormat && !!requestedAuctionFormat && proposedFormat !== requestedAuctionFormat;
        const hasDetails = !!q.quote_plan || (q.quote_fee_items?.length ?? 0) > 0;

        return (
          <div
            key={q.id}
            className={`rounded-xl border p-4 ${
              chosen ? "border-success/40 bg-success/5" : "border-border bg-card"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {q.org?.logo_url ? (
                  <img src={q.org.logo_url} alt={q.org.name} className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{q.org?.name ?? "Tổ chức đấu giá"}</p>
                  {q.org?.province && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {q.org.province}
                    </span>
                  )}
                </div>
              </div>
              {chosen && (
                <Badge className="shrink-0 gap-1 bg-success/10 text-success hover:bg-success/10">
                  <Check className="h-3 w-3" /> Đã chọn
                </Badge>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <div>
                <p className="text-[11px] text-muted-foreground">Thù lao</p>
                <p className={`text-sm font-semibold ${overBudget ? "text-warning" : "text-foreground"}`}>
                  {q.quote_commission_pct != null ? `${q.quote_commission_pct}%` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Phí dịch vụ</p>
                <p className="text-sm font-semibold text-foreground">
                  {q.quote_service_fee != null ? formatVnd(q.quote_service_fee) : "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Giá khởi điểm đề xuất</p>
                <p className="text-sm font-semibold text-foreground">
                  {q.quote_starting_price != null ? formatVnd(q.quote_starting_price) : "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Thời gian dự kiến</p>
                <p className="flex items-center gap-1 text-sm font-semibold text-foreground">
                  {q.quote_lead_time_days != null ? (
                    <>
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      {q.quote_lead_time_days} ngày
                    </>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
            </div>

            {overBudget && (
              <p className="mt-2 text-xs text-warning">
                Cao hơn mức thù lao {acceptableCommissionPct}% bạn đã khai.
              </p>
            )}

            {formatMismatch && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Đề xuất {AUCTION_FORMAT_LABELS[proposedFormat as AuctionFormat] ?? proposedFormat}, khác hình thức{" "}
                {AUCTION_FORMAT_LABELS[requestedAuctionFormat as AuctionFormat] ?? requestedAuctionFormat} bạn yêu cầu.
              </p>
            )}

            {hasDetails && (
              <Collapsible className="mt-3">
                <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
                  Phương án & chi phí chi tiết
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <QuoteDetails
                    plan={q.quote_plan}
                    feeItems={q.quote_fee_items}
                    startingPrice={startingPrice}
                    className="mt-3 rounded-lg border border-border bg-muted/20 p-3"
                  />
                </CollapsibleContent>
              </Collapsible>
            )}

            {q.quote_note && (
              <p className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
                {q.quote_note}
              </p>
            )}

            <div className="mt-3 flex items-center justify-between gap-3">
              {q.quote_doc_path ? <QuoteDocLink path={q.quote_doc_path} /> : <span />}
              {!decided && q.status === "quoted" && (
                <Button size="sm" disabled={isSelecting} onClick={() => onSelect(q)}>
                  Chọn tổ chức này
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
