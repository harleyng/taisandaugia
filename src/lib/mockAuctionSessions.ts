// Deterministic mock auction sessions generator.
// Generates ~5-40 sessions across the last 12 months with realistic noise/outliers
// so the AuctionPriceHistory analytics can demo every branch from a stable seed.

import type { RawSession } from "./auctionPriceAnalytics";

const seedRng = (seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
};

export interface MockOptions {
  // Anchor in display unit (tr/m² for BĐS, or any unit). We'll spread sessions around this.
  anchor: number;
  // 12 if you want a full year of activity
  months?: number;
  // override total session count; otherwise seeded between min/max
  forceCount?: number;
  minCount?: number;
  maxCount?: number;
  // BLOCK 1: anchor area (m²) — sessions get area lognormal-ish around this
  anchorArea?: number;
}

export const generateMockSessions = (seed: string, opts: MockOptions): RawSession[] => {
  const rand = seedRng(seed);
  const months = opts.months ?? 12;
  const minCount = opts.minCount ?? 12;
  const maxCount = opts.maxCount ?? 36;
  const total = opts.forceCount ?? Math.round(minCount + rand() * (maxCount - minCount));

  // Trend factor — pick a directional bias from seed: -0.25..+0.25 over the window
  const trendBias = (rand() - 0.5) * 0.5;

  const now = new Date();
  const sessions: RawSession[] = [];

  // Area generator: spread around anchorArea so we hit 2–3 buckets nearby
  const anchorArea = opts.anchorArea && opts.anchorArea > 0 ? opts.anchorArea : 0;

  for (let i = 0; i < total; i++) {
    // Distribute across last `months` months (skewing slightly more recent)
    const monthOffset = Math.floor(rand() ** 0.85 * months);
    const day = 1 + Math.floor(rand() * 27);
    const date = new Date(now.getFullYear(), now.getMonth() - monthOffset, day);

    // t: 0 (oldest) → 1 (newest)
    const t = 1 - monthOffset / Math.max(1, months - 1);
    const trend = 1 + trendBias * (t - 0.5) * 2;
    const noise = 1 + (rand() - 0.5) * 0.18; // ±9%
    let price = opts.anchor * trend * noise;

    // Inject occasional outlier (~5%)
    if (rand() < 0.05) {
      price *= rand() < 0.5 ? 0.4 : 1.9;
    }

    // Area: lognormal-ish around anchor (mostly within ±35%, occasionally further)
    let area: number | undefined;
    if (anchorArea > 0) {
      const u = rand();
      // multiplier in roughly 0.55x .. 1.7x with some long-tail
      const mult = 0.55 + Math.pow(u, 1.4) * 1.15 + (rand() - 0.5) * 0.2;
      area = Math.max(10, Math.round(anchorArea * mult));
    }

    sessions.push({
      date,
      price: Math.round(price * 10) / 10,
      area,
    });
  }

  return sessions;
};
