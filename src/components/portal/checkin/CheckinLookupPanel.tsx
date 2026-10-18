import { useEffect, useState } from "react";
import { Loader2, QrCode, Search, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DESIGN_BTN } from "@/components/portal/auction-sessions/SessionDetailHero";
import { useCheckinLookup } from "@/hooks/useSessionCheckin";
import { biddingErrorMessage, biddingReasonMessage } from "@/lib/bidding/errors";
import { maskIdNumber } from "@/lib/biddingContracts/filters";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import type { CheckinLookupMatch } from "@/types/bidding-contract";
import { TicketScanner } from "./TicketScanner";

interface Props {
  sessionId: string;
  /** Mở hộp đối chiếu (CheckInConfirmDialog do tab giữ — dùng chung với danh sách). */
  onSelect: (match: CheckinLookupMatch) => void;
}

const DEBOUNCE_MS = 300;

/**
 * Bàn điểm danh tại cửa (design `.lookup`): máy quét phiếu gõ mã vào ô rồi Enter, hoặc
 * quét bằng camera (khớp đúng 1 hồ sơ ⇒ mở thẳng hộp đối chiếu), hoặc tìm theo tên /
 * số giấy tờ / mã hồ sơ / tên tổ chức.
 */
export function CheckinLookupPanel({ sessionId, onSelect }: Props) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  // Mã vừa quét — để chỉ tự mở hộp đối chiếu một lần cho mỗi lần quét.
  const [scannedToken, setScannedToken] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setQuery(input.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [input]);

  const lookup = useCheckinLookup(sessionId, query);
  const matches = lookup.data?.matches ?? [];

  useEffect(() => {
    if (!scannedToken || query !== scannedToken || !lookup.data) return;
    if (lookup.data.by_token && lookup.data.matches.length === 1) onSelect(lookup.data.matches[0]);
    setScannedToken(null);
  }, [lookup.data, query, scannedToken, onSelect]);

  const onScanned = (text: string) => {
    const token = text.trim();
    setScanning(false);
    setInput(token);
    setQuery(token);
    setScannedToken(token);
  };

  // Enter / "Tìm": máy quét phiếu gõ mã rồi Enter ⇒ cũng tự mở hộp đối chiếu như quét camera.
  const searchNow = () => {
    const q = input.trim();
    setQuery(q);
    setScannedToken(q);
  };

  return (
    <section className="space-y-3 rounded-2xl bg-card px-4 py-3.5 shadow-card">
      <form
        className="flex gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          searchNow();
        }}
      >
        <label className="flex h-[38px] min-w-0 flex-1 items-center gap-2 rounded-lg px-3 text-muted-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))] focus-within:shadow-[0_0_0_2px_hsl(var(--primary))]">
          <Search className="h-[18px] w-[18px] shrink-0" aria-hidden />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Quét mã trên phiếu hoặc nhập tên, CCCD, mã hồ sơ"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            aria-label="Tìm hồ sơ để điểm danh"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setScanning(true)}
            className="-mr-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-muted hover:text-foreground"
            title="Quét phiếu bằng camera"
            aria-label="Quét phiếu bằng camera"
          >
            <QrCode className="h-4 w-4" />
          </button>
        </label>
        <Button type="submit" className={DESIGN_BTN}>
          Tìm
        </Button>
      </form>

      {query.length >= 2 && (
        <div className="space-y-2">
          {lookup.isFetching && !lookup.data ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tìm…
            </div>
          ) : lookup.isError ? (
            <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {biddingErrorMessage(lookup.error)}
            </p>
          ) : matches.length === 0 ? (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              {lookup.data?.by_token
                ? "Không tìm thấy hồ sơ của phiếu này — phiếu có thể đã bị huỷ."
                : "Không có hồ sơ nào khớp."}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {matches.map((m) => (
                <MatchRow key={m.id} match={m} onOpen={() => onSelect(m)} />
              ))}
            </ul>
          )}
        </div>
      )}

      <TicketScanner open={scanning} onOpenChange={setScanning} onDetected={onScanned} />
    </section>
  );
}

function MatchRow({ match, onOpen }: { match: CheckinLookupMatch; onOpen: () => void }) {
  const checkedIn = match.checked_in_at != null;
  const ready = !checkedIn && !match.block_reason;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="font-medium text-foreground">
          {match.full_name}
          {match.has_proxy && match.proxy_full_name && (
            <span className="font-normal text-muted-foreground"> · uỷ quyền {match.proxy_full_name}</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="font-mono">{match.code}</span> · {maskIdNumber(match.id_number)}
          {match.org_name && ` · ${match.org_name}`}
        </p>
        {!checkedIn && match.block_reason && (
          <p className="mt-0.5 text-xs text-warning">{biddingReasonMessage(match.block_reason)}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {checkedIn && <Badge variant="secondary">SBD {formatBidderNo(match.bidder_no)}</Badge>}
        <Button size="sm" variant={ready ? "default" : "outline"} className="gap-1.5" onClick={onOpen}>
          <UserCheck className="h-4 w-4" />
          {ready ? "Điểm danh" : "Xem"}
        </Button>
      </div>
    </li>
  );
}
