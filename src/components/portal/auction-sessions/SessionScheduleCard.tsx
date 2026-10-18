import { cn } from "@/lib/utils";
import {
  scheduleTimeline,
  TIMELINE_MARK_TITLES,
  type TimelineMark,
  type TimelinePoint,
} from "@/lib/auctionSessions/sessionDetail";
import type { AuctionSession } from "@/types/auction-session";
import { DetailCard } from "./DetailCard";

const ICON: Partial<Record<TimelineMark, JSX.Element>> = {
  done: <path d="M5 12.5 10 17 19 7.5" />,
  cur: <path d="M12 7v5l3 2" />,
  live: <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />,
};

const DOT: Record<TimelineMark, string> = {
  done: "bg-primary text-primary-foreground",
  cur: "bg-card text-primary shadow-[inset_0_0_0_1.5px_hsl(var(--primary))]",
  live: "bg-card text-destructive shadow-[inset_0_0_0_1.5px_hsl(var(--destructive))]",
  "": "bg-card text-muted-foreground shadow-[inset_0_0_0_1.5px_hsl(var(--border))]",
  na: "text-muted-foreground shadow-[inset_0_0_0_1.5px_hsl(var(--border))] bg-[repeating-linear-gradient(45deg,hsl(var(--card))_0_3px,hsl(var(--muted))_3px_6px)]",
};

/**
 * Một mốc: chấm + đường nối sang mốc kế bên, dưới là nhãn / ngày / giờ.
 * `link` = "inner" nối sang mốc thứ hai trong cùng khối (vượt khe 12px),
 * "outer" nối sang khối kế (vượt đệm 14px + khe 12px + đệm 14px).
 */
function Point({ p, link }: { p: TimelinePoint; link: "inner" | "outer" | null }) {
  const na = p.mark === "na";
  return (
    <div className="flex min-w-0 flex-col">
      <div className="relative mb-2.5 h-[22px]">
        {link && (
          <span
            aria-hidden
            className={cn(
              "absolute left-[11px] top-[11px] h-px",
              link === "inner" ? "-right-3" : "-right-[42px] max-[860px]:hidden",
              p.mark === "done" ? "bg-primary" : "bg-border",
            )}
          />
        )}
        <i
          title={TIMELINE_MARK_TITLES[p.mark]}
          className={cn("absolute left-0 top-0 z-[1] grid h-[22px] w-[22px] place-items-center rounded-full", DOT[p.mark])}
        >
          {ICON[p.mark] && (
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2.2]"
            >
              {ICON[p.mark]}
            </svg>
          )}
        </i>
      </div>
      <div className="flex flex-col gap-0.5 tabular-nums">
        {p.label && <em className="mb-0.5 block h-4 text-xs not-italic leading-4 text-muted-foreground">{p.label}</em>}
        <b className={cn("text-sm font-semibold", na && "font-medium text-muted-foreground/70")}>{p.date}</b>
        <span className={cn("text-[12.5px] text-muted-foreground", na && "font-medium text-muted-foreground/70")}>
          {p.time}
        </span>
      </div>
    </div>
  );
}

/** "Lịch phiên" của tab Thông tin (design `.lp`): ba khối mốc nối thành một dải. */
export function SessionScheduleCard({ session }: { session: AuctionSession }) {
  const stages = scheduleTimeline(session);
  return (
    <DetailCard title="Lịch phiên">
      <ol className="flex gap-3 px-[22px] pb-[22px] pt-3 max-[860px]:flex-wrap">
        {stages.map((stage, i) => {
          const last = i === stages.length - 1;
          return (
            <li
              key={stage.title}
              className={cn(
                "flex min-w-0 flex-[1_1_0] flex-col rounded-xl px-3.5 pb-3.5 pt-3 max-[860px]:basis-[calc(50%-6px)]",
                stage.multi && "grow-[2] bg-muted max-[860px]:basis-full",
              )}
            >
              <div className="mb-3 h-[58px] text-center">
                <b className="block text-[13.5px] font-semibold text-foreground">{stage.title}</b>
                <small className="mt-0.5 block text-[12.5px] text-muted-foreground [text-wrap:pretty]">{stage.sub}</small>
              </div>
              {stage.multi ? (
                <div className="grid grid-cols-2 gap-3">
                  <Point p={stage.points[0]} link="inner" />
                  <Point p={stage.points[1]} link={last ? null : "outer"} />
                </div>
              ) : (
                <Point p={stage.points[0]} link={last ? null : "outer"} />
              )}
            </li>
          );
        })}
      </ol>
    </DetailCard>
  );
}
