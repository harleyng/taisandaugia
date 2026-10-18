import { Link } from "react-router-dom";
import { formatBidderNo } from "@/lib/biddingContracts/paths";
import { clockText } from "@/lib/bidding/roomView";
import { RoomPill } from "./RoomPill";

/** Thanh đầu phòng đấu giá: về trang phiên · mã + tên phiên · giờ máy chủ · số báo danh. */

interface Props {
  sessionPath: string;
  code: string;
  title: string;
  now: Date;
  clockReady: boolean;
  bidderNo: number;
}

export function RoomHeader({ sessionPath, code, title, now, clockReady, bidderNo }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-4 px-5 py-2.5">
        <Link
          to={sessionPath}
          className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          ← Về trang phiên
        </Link>
        <div className="min-w-0 flex-1">
          <small className="block font-mono text-[11.5px] text-muted-foreground">{code}</small>
          <b className="block truncate text-sm text-foreground md:text-[15px]">{title}</b>
        </div>
        <div className="flex flex-wrap items-center gap-3.5">
          <RoomPill tone="onair">Trực tuyến</RoomPill>
          <span className="hidden font-mono text-[13px] tabular-nums text-muted-foreground md:inline">
            {clockReady ? clockText(now) : "--:--:--"}
          </span>
          <div className="rounded-[10px] bg-[hsl(var(--sidebar-background))] py-1.5 pl-2.5 pr-3 text-primary-foreground">
            <small className="block text-[11px] leading-tight text-[hsl(var(--tier-std-card-muted))]">
              Số báo danh của bạn
            </small>
            <b className="block font-mono text-lg leading-tight tracking-[.02em]">{formatBidderNo(bidderNo)}</b>
          </div>
        </div>
      </div>
    </header>
  );
}
