import { Button } from "@/components/ui/button";
import type { MyContract } from "@/hooks/useBuyerContracts";
import { formatClock } from "@/lib/biddingContracts/attendanceTicket";
import { checkinOpenFor } from "@/lib/biddingContracts/buyerContract";
import { checkinWindowOf } from "@/lib/biddingContracts/checkinWindow";

/**
 * Băng "Đang mở điểm danh" đầu trang Hồ sơ của tôi (design hs-mine.js `ckBanner`):
 * hồ sơ đầu tiên đang trong giờ điểm danh — trực tuyến mở thẳng modal mã xác
 * nhận, trực tiếp mở phiếu QR. Tự ẩn khi không còn hồ sơ nào đang mở.
 */
export function CheckinOpenBanner({
  contracts,
  now,
  onOpen,
}: {
  contracts: MyContract[];
  now: Date;
  onOpen: (kind: "checkin" | "ticket", c: MyContract) => void;
}) {
  const c = contracts.find((x) => checkinOpenFor(x, now));
  const s = c?.auction_sessions;
  if (!c || !s) return null;
  const onsite = s.auction_format === "truc_tiep";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-primary/[.08] px-4 py-3 text-sm text-foreground">
      <span className="h-2 w-2 shrink-0 rounded-full bg-destructive shadow-[0_0_0_4px_hsl(var(--destructive)/.18)]" aria-hidden />
      <span className="min-w-0">
        <b className="font-semibold">Đang mở điểm danh</b> · {s.code ?? s.title} — đóng lúc{" "}
        {formatClock(checkinWindowOf(s).closesAt)}. Quá giờ sẽ bị ghi vắng và mất tiền đặt trước.
      </span>
      <span className="flex-1" />
      <Button size="sm" className="h-8" onClick={() => onOpen(onsite ? "ticket" : "checkin", c)}>
        {onsite ? "Mở phiếu dự phiên" : "Điểm danh ngay"}
      </Button>
    </div>
  );
}
