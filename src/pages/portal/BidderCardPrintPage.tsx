import { useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBiddingContract } from "@/hooks/useBiddingContracts";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { formatBidderNo, sessionCheckinPath } from "@/lib/biddingContracts/paths";

/** Khổ A6 chỉ áp cho trang này (thẻ đặt trên bàn / đeo trước ngực). */
const PRINT_CSS = `@page { size: A6 portrait; margin: 0; }
@media print { html, body { background: #fff; } }`;

/**
 * Thẻ số báo danh — /portal/phien-dau-gia/:id/diem-danh/:contractId/the.
 * KHÔNG in số CCCD / ngày sinh / SĐT: thẻ để công khai trong phòng đấu giá.
 * `?auto=1` ⇒ tự mở hộp thoại in khi dữ liệu xong.
 */
const BidderCardPrintPage = () => {
  const { id: sessionId, contractId } = useParams<{ id: string; contractId: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: contract, isLoading } = useBiddingContract(contractId);
  const printed = useRef(false);

  const session = contract?.auction_sessions ?? null;
  const ready = !!contract && contract.session_id === sessionId && !!contract.checked_in_at && contract.bidder_no != null;

  useEffect(() => {
    if (!ready || !contract) return;
    const previous = document.title;
    document.title = `Thẻ SBD ${formatBidderNo(contract.bidder_no)} — ${session?.code ?? contract.code}`;
    return () => {
      document.title = previous;
    };
  }, [ready, contract, session]);

  useEffect(() => {
    if (!ready || printed.current || params.get("auto") !== "1") return;
    printed.current = true;
    const t = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(t);
  }, [ready, params]);

  const back = () => navigate(sessionId ? sessionCheckinPath(sessionId) : "/portal/phien-dau-gia");

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ready || !contract) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-base font-semibold text-foreground">
          {contract && contract.session_id === sessionId
            ? "Người tham gia chưa điểm danh nên chưa có số báo danh."
            : "Không tìm thấy hồ sơ, hoặc bạn không có quyền xem hồ sơ tham gia của phiên này."}
        </p>
        <Button variant="outline" onClick={back}>
          Về màn điểm danh
        </Button>
      </div>
    );
  }

  const attendeeName = contract.checkin_attendee === "proxy" ? contract.proxy_full_name : contract.full_name;

  return (
    <div className="min-h-screen bg-muted text-foreground print:bg-background">
      <style>{PRINT_CSS}</style>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background px-4 py-3 print:hidden">
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={back}>
          <ArrowLeft className="h-4 w-4" />
          Về màn điểm danh
        </Button>
        <Button className="gap-1.5" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          In thẻ
        </Button>
      </div>

      <div className="flex justify-center p-6 print:p-0">
        {/* 105 × 148 mm = A6 */}
        <article className="flex h-[148mm] w-[105mm] flex-col items-center justify-between border border-border bg-background p-[8mm] text-center print:border-0">
          <header className="space-y-1">
            <p className="text-[10pt] font-semibold uppercase tracking-widest text-primary">Thẻ số báo danh</p>
            {session?.code && <p className="font-mono text-[9pt] text-muted-foreground">{session.code}</p>}
            <p className="text-[10pt] font-medium leading-snug">{session?.title}</p>
            {session && <p className="text-[9pt] text-muted-foreground">{formatDateTime(session.starts_at)}</p>}
          </header>

          <p className="font-mono text-[72pt] font-bold leading-none tracking-wider">
            {formatBidderNo(contract.bidder_no)}
          </p>

          <footer className="w-full space-y-1 border-t border-border pt-[4mm]">
            {contract.org_name && <p className="text-[11pt] font-semibold leading-snug">{contract.org_name}</p>}
            <p className={contract.org_name ? "text-[10pt]" : "text-[13pt] font-semibold"}>{attendeeName}</p>
            {contract.checkin_attendee === "proxy" && (
              <p className="text-[8pt] text-muted-foreground">Người được uỷ quyền của {contract.full_name}</p>
            )}
            <p className="font-mono text-[8pt] text-muted-foreground">{contract.code}</p>
          </footer>
        </article>
      </div>
    </div>
  );
};

export default BidderCardPrintPage;
