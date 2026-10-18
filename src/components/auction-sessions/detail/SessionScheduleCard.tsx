import { CalendarDays, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { sessionSchedule, type ScheduleStepState } from "@/lib/auctionSessions/schedule";
import type { PublicSessionDetail } from "@/types/auction-session";
import { SectionCard } from "./ui";

const BLOCK: Record<ScheduleStepState, string> = {
  done: "md:bg-muted",
  current: "md:bg-[hsl(var(--tier-info-bg))]",
  live: "md:bg-destructive/[.08]",
  todo: "md:bg-muted",
};

function Dot({ state }: { state: ScheduleStepState }) {
  return (
    <span
      className={cn(
        "relative z-[1] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full",
        state === "done" && "bg-primary",
        state === "current" && "bg-[hsl(var(--tier-info)/.2)]",
        state === "live" && "bg-destructive/15",
        state === "todo" && "border-[1.5px] border-dashed border-muted-foreground/60 bg-transparent",
      )}
    >
      {state === "done" && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
      {state === "current" && <span className="h-2 w-2 rounded-full bg-[hsl(var(--tier-info))]" />}
      {state === "live" && <span className="h-2 w-2 rounded-full bg-destructive" />}
    </span>
  );
}

/** "Lịch phiên": bán & nhận hồ sơ → xem tài sản → đấu giá (design `.tl`). */
export function SessionScheduleCard({ session }: { session: PublicSessionDetail }) {
  const steps = sessionSchedule(session);
  return (
    <SectionCard icon={CalendarDays} title="Lịch phiên">
      <ol
        className={cn(
          "grid gap-0 px-4 pb-4 pt-1 md:gap-2",
          steps.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2",
        )}
      >
        {steps.map((st, i) => (
          <li
            key={st.key}
            className={cn(
              "relative grid grid-cols-[22px_1fr] gap-2.5 pb-3.5 last:pb-0 md:flex md:flex-col md:gap-2 md:rounded-xl md:p-3.5",
              BLOCK[st.state],
            )}
          >
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute bottom-0 left-[10px] top-[22px] w-0.5 md:hidden",
                  st.state === "done" ? "bg-primary" : "bg-muted",
                )}
              />
            )}
            <Dot state={st.state} />
            <div>
              <b className="text-[13px] text-foreground md:text-sm">{st.label}</b>
              {st.state === "current" && (
                <span className="ml-1.5 text-[11px] font-semibold text-[hsl(var(--tier-info))]">Đang mở</span>
              )}
              {st.state === "live" && <span className="ml-1.5 text-[11px] font-semibold text-destructive">Đang diễn ra</span>}
              <div className="text-[13px] text-foreground">{st.when}</div>
            </div>
          </li>
        ))}
      </ol>
    </SectionCard>
  );
}
