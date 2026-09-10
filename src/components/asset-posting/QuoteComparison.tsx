import { useEffect, useState } from "react";
import { Building2, Check, Clock, Download, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatVnd } from "@/lib/advertising/slug";
import { signQuoteDoc } from "@/hooks/useOrgServiceRequests";
import type { RequestWithOrg } from "@/hooks/useAssetPosting";

interface QuoteComparisonProps {
  /** Chỉ những yêu cầu ĐÃ có báo giá (status 'quoted') hoặc đã chốt. */
  quotes: RequestWithOrg[];
  /** Thù lao chủ tài sản khai là chấp nhận được — để đối chiếu. */
  acceptableCommissionPct?: number | null;
  onSelect: (requestId: string) => void;
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
 * mở một cơ hội trong CRM, nên nút bấm phải rõ đây không phải thao tác nháp.
 */
export function QuoteComparison({
  quotes,
  acceptableCommissionPct,
  onSelect,
  isSelecting,
  decided,
}: QuoteComparisonProps) {
  const [pending, setPending] = useState<string | null>(null);

  if (quotes.length === 0) return null;

  return (
    <div className="space-y-3">
      {quotes.map((q) => {
        const chosen = q.status === "selected";
        const overBudget =
          acceptableCommissionPct != null &&
          q.quote_commission_pct != null &&
          q.quote_commission_pct > acceptableCommissionPct;

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

            {q.quote_note && (
              <p className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
                {q.quote_note}
              </p>
            )}

            <div className="mt-3 flex items-center justify-between gap-3">
              {q.quote_doc_path ? <QuoteDocLink path={q.quote_doc_path} /> : <span />}
              {!decided && q.status === "quoted" && (
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={isSelecting}
                  onClick={() => {
                    setPending(q.id);
                    onSelect(q.id);
                  }}
                >
                  {isSelecting && pending === q.id && <Loader2 className="h-4 w-4 animate-spin" />}
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
