import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ContractFileButton } from "@/components/consignment/ContractFileButton";
import { formatVnd } from "@/lib/advertising/slug";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { MINUTES_BUCKET } from "@/lib/bidding/minutes-pdf/input";
import { useSessionMinutes, useSessionResults } from "@/hooks/useOrgBidding";
import { LOT_RESULT_LABELS } from "@/types/auction-bidding";
import type { PublicSessionDetail } from "@/types/auction-session";

/**
 * Kết quả đấu giá công khai trên /sessions/:id.
 *
 * CHỈ hiện khi phiên đã chốt kết quả: đó cũng là mốc RLS mở biên bản cho khách
 * (auction_session_is_finalized), nên hai thứ ra mặt cùng lúc và không bao giờ
 * công bố con số chưa chính thức.
 *
 * CHỈ SỐ BÁO DANH, không bao giờ tên — auction_bidding_contracts không có policy
 * đọc công khai, nên đây vừa là quy tắc riêng tư vừa là giới hạn dữ liệu thật.
 *
 * Dùng useSessionResults (query thường) chứ KHÔNG dùng useLotStates: hook đó mở
 * kênh realtime `bidding:{id}` mà hai phòng đấu giá đã nhận là nơi mount duy nhất.
 */
export function SessionResultsCard({ session }: { session: PublicSessionDetail }) {
  const finalized = session.status === "published" && !!session.finalized_at;
  const { data: states, isLoading } = useSessionResults(finalized ? session.id : null);
  const { data: minutes = [] } = useSessionMinutes(finalized ? session.id : null);

  if (!finalized) return null;

  const lots = session.auction_session_items ?? [];
  const stateByLot = new Map((states ?? []).map((s) => [s.lot_id, s]));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-foreground">Kết quả đấu giá</h2>
        <p className="text-sm text-muted-foreground">Chốt lúc {formatDateTime(session.finalized_at)}</p>
      </div>

      {isLoading && !states ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : (
        <div className="space-y-2">
          {lots.map((lot) => {
            const st = stateByLot.get(lot.id) ?? null;
            const withdrawn = st?.status === "withdrawn";
            const sold = st?.result === "sold";
            return (
              <Card key={lot.id} className="rounded-2xl p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs text-muted-foreground">Lô {lot.lot_no}</p>
                    <p className="font-medium text-foreground">{lot.title}</p>
                    {withdrawn ? (
                      st?.withdraw_reason && (
                        <p className="text-sm text-muted-foreground">Lý do: {st.withdraw_reason}</p>
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {st?.bid_count ?? 0} lượt trả giá
                        {sold && st?.leading_bidder_no != null && ` · SBD ${formatBidderNo(st.leading_bidder_no)}`}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <Badge variant={withdrawn ? "secondary" : sold ? "default" : "outline"}>
                      {withdrawn ? "Đã rút khỏi phiên" : st?.result ? LOT_RESULT_LABELS[st.result] : "Không thành"}
                    </Badge>
                    {sold && st?.winning_amount != null && (
                      <p className="mt-1 whitespace-nowrap font-semibold text-foreground">
                        {formatVnd(st.winning_amount)}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {minutes.length > 0 && (
        <Card className="space-y-2 rounded-2xl p-4">
          <p className="font-medium text-foreground">Biên bản đấu giá</p>
          {minutes.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Biên bản lần {m.sequence_no} · {formatDateTime(m.issued_at)}
              </p>
              <ContractFileButton path={m.pdf_path} bucket={MINUTES_BUCKET} label="Tải biên bản" />
            </div>
          ))}
          <p className="break-all font-mono text-xs text-muted-foreground">
            SHA-256 {minutes[0].content_hash}
          </p>
        </Card>
      )}
    </section>
  );
}
