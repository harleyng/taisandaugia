import { useEffect, useState } from "react";

const KEY = "companyViewTracker.v1";
const WINDOW_MS = 24 * 60 * 60 * 1000;
const THRESHOLD = 3;

interface View {
  orgId: string;
  ts: number;
}

const read = (): View[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as View[];
  } catch {
    return [];
  }
};

const write = (v: View[]) => localStorage.setItem(KEY, JSON.stringify(v));

/** Track org views; returns whether nudge should be shown for `orgId`. */
export const useCompanyViewTracker = (orgId: string | null | undefined, listingId: string | null | undefined) => {
  const [shouldNudge, setShouldNudge] = useState(false);

  useEffect(() => {
    if (!orgId || !listingId) return;
    const now = Date.now();
    const all = read().filter((v) => now - v.ts < WINDOW_MS);
    // de-dupe by recent listing visit (simple: skip if last entry same orgId in <30s)
    const last = all[all.length - 1];
    if (!last || last.orgId !== orgId || now - last.ts > 30_000) {
      all.push({ orgId, ts: now });
      // cap buffer
      while (all.length > 30) all.shift();
      write(all);
    }
    const sameOrgCount = all.filter((v) => v.orgId === orgId).length;
    setShouldNudge(sameOrgCount >= THRESHOLD);
  }, [orgId, listingId]);

  const dismissed = orgId ? sessionStorage.getItem(`nudge_dismissed_${orgId}`) === "1" : false;
  const dismiss = () => {
    if (orgId) sessionStorage.setItem(`nudge_dismissed_${orgId}`, "1");
    setShouldNudge(false);
  };

  return { shouldNudge: shouldNudge && !dismissed, dismiss };
};
