import { useEffect, useState } from "react";
import { Loader2, QrCode, Search, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
 * Bàn điểm danh tại cửa: quét QR trên phiếu (khớp đúng 1 hồ sơ ⇒ mở thẳng hộp
 * đối chiếu) hoặc tìm theo tên / số giấy tờ / mã hồ sơ / tên tổ chức.
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

  return (
    <Card className="space-y-4 rounded-2xl p-5">
      <div>
        <h2 className="font-semibold text-foreground">Điểm danh tại cửa</h2>
        <p className="text-xs text-muted-foreground">
          Quét mã QR trên phiếu dự phiên, hoặc tìm theo họ tên, số CCCD / hộ chiếu, mã hồ sơ, tên tổ chức.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="gap-1.5" onClick={() => setScanning(true)}>
          <QrCode className="h-4 w-4" />
          Quét phiếu
        </Button>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Họ tên, số giấy tờ, mã hồ sơ…"
            className="pl-9"
            aria-label="Tìm hồ sơ để điểm danh"
          />
        </div>
      </div>

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
    </Card>
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
