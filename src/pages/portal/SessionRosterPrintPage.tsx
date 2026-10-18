import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuctionSession } from "@/hooks/useAuctionSessions";
import { useServerNow } from "@/hooks/useServerClock";
import { useSessionCheckin } from "@/hooks/useSessionCheckin";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { boardGroupOf, boardStatusOf, boardWindowOf, formatCheckinTime } from "@/lib/biddingContracts/checkinBoard";
import { buildRoster } from "@/lib/biddingContracts/checkinRoster";
import { formatBidderNo, sessionCheckinPath } from "@/lib/biddingContracts/paths";

const PRINT_CSS = `@page { size: A4 portrait; margin: 12mm; }
@media print { html, body { background: #fff; } }`;

const ATTENDEE = { principal: "Chính chủ", proxy: "Người được uỷ quyền" } as const;
const TH = "border border-border px-2 py-1.5 text-left text-[9pt] font-semibold";
const TD = "border border-border px-2 py-1.5 align-top text-[9.5pt]";

/**
 * Danh sách điểm danh A4 — /portal/phien-dau-gia/:id/diem-danh/in (nút "In danh sách"
 * của tab Điểm danh). Ngoài PortalLayout như thẻ SBD: RLS là cổng. Cột "Ký xác nhận"
 * để người có mặt ký tại bàn. `?auto=1` ⇒ tự mở hộp thoại in.
 */
const SessionRosterPrintPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: session, isLoading: loadingSession } = useAuctionSession(id);
  const { roster, summary } = useSessionCheckin(id);
  const now = useServerNow(60_000);
  const printed = useRef(false);

  const closedAt = summary.data?.roster_closed_at;
  const s = useMemo(
    () => (session ? { ...session, roster_closed_at: closedAt ?? session.roster_closed_at } : null),
    [session, closedAt],
  );
  const window_ = s ? boardWindowOf(s, now) : "before";
  const rows = useMemo(
    () =>
      s
        ? buildRoster(
            (roster.data ?? []).filter((c) => c.status === "paid" && c.review_status === "approved"),
            s,
            now,
          ).map((r) => ({ ...r, board: boardGroupOf(r.state) }))
        : [],
    [s, roster.data, now],
  );
  const ready = !!s && !roster.isLoading;

  useEffect(() => {
    if (!s) return;
    const previous = document.title;
    document.title = `Danh sách điểm danh — ${s.code ?? s.title}`;
    return () => {
      document.title = previous;
    };
  }, [s]);

  useEffect(() => {
    if (!ready || printed.current || params.get("auto") !== "1") return;
    printed.current = true;
    const t = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(t);
  }, [ready, params]);

  const back = () => navigate(id ? sessionCheckinPath(id) : "/portal/phien-dau-gia");

  if (loadingSession || roster.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!s) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-base font-semibold text-foreground">
          Không tìm thấy phiên, hoặc bạn không có quyền xem danh sách điểm danh.
        </p>
        <Button variant="outline" onClick={back}>
          Về màn điểm danh
        </Button>
      </div>
    );
  }

  const present = rows.filter((r) => r.board === "in").length;
  const absent = rows.filter((r) => r.board === "abs").length;
  const excused = rows.filter((r) => r.board === "exc").length;
  const tally = [
    `${present}/${rows.length} người có mặt`,
    absent > 0 && `${absent} vắng`,
    excused > 0 && `${excused} vắng có lý do`,
  ]
    .filter(Boolean)
    .join(" · ");

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
          In danh sách
        </Button>
      </div>

      <div className="flex justify-center p-6 print:p-0">
        <article className="w-[210mm] max-w-full space-y-4 bg-background p-[12mm] shadow-card print:w-auto print:p-0 print:shadow-none">
          <header className="space-y-1 text-center">
            <p className="text-[13pt] font-bold uppercase tracking-wide">Danh sách điểm danh</p>
            <p className="text-[10.5pt] font-medium">{s.title}</p>
            <p className="text-[9pt] text-muted-foreground">
              <span className="font-mono">{s.code}</span> · {formatDateTime(s.starts_at)}
              {s.venue && ` · ${s.venue}`}
            </p>
          </header>

          <div className="flex flex-wrap justify-between gap-2 text-[9pt]">
            <span className="font-semibold">{tally}</span>
            <span className="text-muted-foreground">
              {s.roster_closed_at ? `Chốt danh sách lúc ${formatDateTime(s.roster_closed_at)}` : "Chưa chốt danh sách"}
              {" · "}In lúc {formatDateTime(now.toISOString())}
            </span>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-muted print:bg-transparent">
                <th className={TH}>STT</th>
                <th className={TH}>SBD</th>
                <th className={TH}>Người tham gia</th>
                <th className={TH}>Trạng thái</th>
                <th className={TH}>Điểm danh lúc</th>
                <th className={TH}>Người có mặt</th>
                <th className={`${TH} w-[28mm]`}>Ký xác nhận</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`${TD} py-6 text-center text-muted-foreground`}>
                    Chưa có người tham gia nào được duyệt hồ sơ.
                  </td>
                </tr>
              ) : (
                rows.map(({ contract: c, board }, i) => (
                  <tr key={c.id} className="break-inside-avoid">
                    <td className={`${TD} tabular-nums`}>{i + 1}</td>
                    <td className={`${TD} font-mono font-bold`}>
                      {c.checked_in_at ? (formatBidderNo(c.bidder_no) ?? "—") : "—"}
                    </td>
                    <td className={TD}>
                      <p className="font-semibold">{c.org_name ?? c.full_name}</p>
                      <p className="text-[8.5pt] text-muted-foreground">
                        {c.org_name && `ĐDPL: ${c.full_name} · `}
                        <span className="font-mono">{c.code}</span>
                      </p>
                    </td>
                    <td className={TD}>
                      {boardStatusOf(board, window_).label}
                      {board === "exc" && c.absence_note && (
                        <p className="text-[8.5pt] text-muted-foreground">{c.absence_note}</p>
                      )}
                    </td>
                    <td className={`${TD} whitespace-nowrap tabular-nums`}>{formatCheckinTime(c.checked_in_at) ?? "—"}</td>
                    <td className={TD}>
                      {c.checkin_attendee === "proxy"
                        ? `${ATTENDEE.proxy}: ${c.proxy_full_name ?? "—"}`
                        : c.checkin_attendee
                          ? ATTENDEE.principal
                          : "—"}
                    </td>
                    <td className={TD} />
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </article>
      </div>
    </div>
  );
};

export default SessionRosterPrintPage;
