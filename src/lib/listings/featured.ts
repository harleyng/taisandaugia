// Tin nổi bật trên sàn (gói "Tin nổi bật 7 ngày" — docs/owner-marketing-plan.md Phase M4).
//
// Bản sao luật SQL (migration 20261002110000): đang nổi bật = featured AND
// (featured_until IS NULL OR featured_until > now()). Cờ chỉ admin đổi được; hết hạn thì
// cờ vẫn còn trong DB nhưng không còn tính là nổi bật.

export interface FeaturedFields {
  featured?: boolean | null;
  featured_until?: string | null;
}

export function isFeaturedNow(l: FeaturedFields, now = Date.now()): boolean {
  if (!l.featured) return false;
  return !l.featured_until || new Date(l.featured_until).getTime() > now;
}

/** Tin nổi bật lên trước, giữ nguyên thứ tự còn lại (sắp xếp ổn định). */
export function featuredFirst<T extends FeaturedFields>(rows: readonly T[], now = Date.now()): T[] {
  const top: T[] = [];
  const rest: T[] = [];
  for (const r of rows) (isFeaturedNow(r, now) ? top : rest).push(r);
  return [...top, ...rest];
}
