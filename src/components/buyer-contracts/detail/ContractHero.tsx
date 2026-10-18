import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/auctionSessions/datetime";
import { PROGRESS_STEPS, detailBadgeOf, isLiveFor, progressStepOf } from "@/lib/biddingContracts/buyerContract";
import type { MyContract } from "@/hooks/useBuyerContracts";
import { TagPill } from "../ui";

/** Đầu trang chi tiết hồ sơ: nhãn, mã, phiên, thanh tiến độ 5 chặng. */
export function ContractHero({ contract: c, wonCount, now }: { contract: MyContract; wonCount: number; now: Date }) {
  const s = c.auction_sessions;
  const step = progressStepOf(c, now);
  return (
    <section className="mb-6 rounded-2xl bg-card p-6">
      <div className="flex flex-wrap items-center gap-1.5">
        <TagPill tag={detailBadgeOf(c, { now, wonCount })} />
        {isLiveFor(c, now) && <TagPill tag={{ label: "Đang diễn ra", tone: "live" }} />}
      </div>
      <h1 className="mt-2.5 text-[28px] font-bold leading-tight text-foreground">
        Hồ sơ <span className="font-mono">{c.code}</span>
      </h1>
      {s && (
        <p className="mt-1 text-sm text-muted-foreground">
          <Link to={`/sessions/${s.id}`} className="text-primary hover:underline">
            {s.title}
          </Link>
          {s.code && (
            <>
              {" · "}
              <span className="font-mono">{s.code}</span>
            </>
          )}
          {" · "}Đấu giá {formatDateTime(s.starts_at)}
        </p>
      )}
      <ol className="mt-[18px] grid grid-cols-5 gap-1.5" aria-label="Tiến độ hồ sơ">
        {PROGRESS_STEPS.map((label, i) => {
          const done = i < step;
          const cur = i === step;
          return (
            <li key={label} className={cn("text-xs", cur ? "font-semibold text-foreground" : "text-muted-foreground")}>
              <i className={cn("mb-1.5 block h-1 rounded-sm", done ? "bg-primary" : cur ? "bg-accent" : "bg-border")} />
              {label}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
