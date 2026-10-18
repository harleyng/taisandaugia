import { BidderNoChip, DetailCard } from "@/components/portal/auction-sessions/DetailCard";
import type { ContractWithSession } from "@/types/bidding-contract";

/**
 * "Người có mặt" ở cột phải (design `controlTab`): số báo danh của người đã
 * điểm danh — 12 ô đầu + "+N".
 *
 * Thiếu quyền ho-so-tham-gia.view thì RLS trả 0 hồ sơ — nói rõ thay vì để trống,
 * vì giữa phiên ô trống sẽ bị đọc thành "không ai đến".
 */

const SHOWN = 12;

interface Props {
  contracts: ContractWithSession[];
  canView: boolean;
  /** Đã chốt / đang mở điểm danh — trước đó chưa có gì để hiện. */
  started: boolean;
  present: number;
  eligible: number;
}

export function BidderRoster({ contracts, canView, started, present, eligible }: Props) {
  const here = contracts
    .filter((c) => c.checked_in_at && c.bidder_no != null)
    .sort((a, b) => (a.bidder_no ?? 0) - (b.bidder_no ?? 0));

  return (
    <DetailCard
      title="Người có mặt"
      aside={<span className="tabular-nums">{started ? `${present}/${eligible}` : "Chưa điểm danh"}</span>}
    >
      {!started ? (
        <p className="px-[22px] pb-5 pt-1.5 text-[13px] text-muted-foreground">Danh sách hiện khi chốt điểm danh.</p>
      ) : !canView ? (
        <p className="px-[22px] pb-5 pt-1.5 text-[13px] text-muted-foreground">
          Cần quyền <strong>Hồ sơ tham gia đấu giá · Xem</strong> để thấy số báo danh.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5 px-[22px] pb-5 pt-2.5 [&>span]:min-w-0">
          {here.slice(0, SHOWN).map((c) => (
            <BidderNoChip key={c.id} no={c.bidder_no} />
          ))}
          {here.length > SHOWN && (
            <span className="ml-0.5 self-center text-[12.5px] text-muted-foreground">+{here.length - SHOWN}</span>
          )}
        </div>
      )}
    </DetailCard>
  );
}
