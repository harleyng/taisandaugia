// "Lịch phiên" trên trang /sessions/:id: 3 mốc (bán & nhận hồ sơ → xem tài sản →
// đấu giá), mỗi mốc đã qua / đang mở / đang diễn ra / chưa tới — suy từ cột thời
// gian, giống sessionPhaseOf.

import { formatShortDate } from "./listBadge";

export type ScheduleStepState = "done" | "current" | "live" | "todo";

export interface ScheduleStep {
  key: "sale" | "viewing" | "auction";
  label: string;
  when: string;
  state: ScheduleStepState;
}

export interface ScheduleSession {
  status: string;
  registration_start_at: string | null;
  registration_end_at: string | null;
  viewing_start_at: string | null;
  viewing_end_at: string | null;
  starts_at: string;
  ends_at: string;
  finalized_at?: string | null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : Number.NaN);

/** "25/09/26 08:00 → 20/10/26 17:00"; cùng ngày ⇒ "22/10/26 09:00 → 11:30"; withTime=false bỏ giờ. */
export function formatSpan(start: string | null, end: string | null, withTime = true): string {
  const one = (iso: string) => {
    const d = new Date(iso);
    return withTime ? `${formatShortDate(iso)} ${time(d)}` : formatShortDate(iso);
  };
  if (start && end) {
    const a = new Date(start);
    const b = new Date(end);
    const sameDay = a.toDateString() === b.toDateString();
    if (sameDay && withTime) return `${one(start)} → ${time(b)}`;
    if (sameDay) return one(start);
    return `${one(start)} → ${one(end)}`;
  }
  if (start) return `Từ ${one(start)}`;
  if (end) return `Đến ${one(end)}`;
  return "Chưa công bố";
}

function windowState(startIso: string | null, endIso: string | null, t: number): ScheduleStepState {
  const start = ms(startIso);
  const end = ms(endIso);
  if (!Number.isNaN(end) && t > end) return "done";
  if ((Number.isNaN(start) || t >= start) && (!Number.isNaN(end) || !Number.isNaN(start))) return "current";
  return "todo";
}

export function sessionSchedule(s: ScheduleSession, now: Date = new Date()): ScheduleStep[] {
  const t = now.getTime();
  const cancelled = s.status === "cancelled";
  const steps: ScheduleStep[] = [
    {
      key: "sale",
      label: "Bán & nhận hồ sơ",
      when: formatSpan(s.registration_start_at, s.registration_end_at),
      // Không khai hạn ⇒ nhận tới giờ đấu (cùng quy ước sessionPhaseOf).
      state: windowState(s.registration_start_at, s.registration_end_at ?? s.starts_at, t),
    },
  ];
  if (s.viewing_start_at || s.viewing_end_at) {
    steps.push({
      key: "viewing",
      label: "Xem tài sản",
      when: `${formatSpan(s.viewing_start_at, s.viewing_end_at, false)} · theo lịch hẹn`,
      state: windowState(s.viewing_start_at, s.viewing_end_at, t),
    });
  }
  const auction = s.finalized_at ? "done" : windowState(s.starts_at, s.ends_at, t);
  steps.push({
    key: "auction",
    label: "Đấu giá",
    when: formatSpan(s.starts_at, s.ends_at),
    state: auction === "current" ? "live" : auction,
  });
  return cancelled ? steps.map((st) => ({ ...st, state: "todo" })) : steps;
}
