/**
 * RNG tất định dùng chung cho các engine mock (gợi ý tổ chức, trích xuất AI).
 *
 * FNV-1a 32-bit trên `seed::salt` → [0,1). Cùng cặp (seed, salt) luôn ra cùng một
 * số, nên giá trị mock ổn định qua mọi lần render VÀ qua reload — điều kiện bắt
 * buộc để UI không nhấp nháy và để viết được unit test.
 *
 * Khác với `seedRng` trong mockAuctionSessions.ts: hàm đó trả về một generator CÓ
 * TRẠNG THÁI (mỗi lần gọi ra số khác), dùng để rải một chuỗi dữ liệu. Hàm này là
 * ánh xạ thuần khoá → số. Đừng gộp hai thứ đó lại.
 */
export function seededRand(seed: string, salt: string): number {
  let h = 0x811c9dc5;
  const str = `${seed}::${salt}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // >>> 0 để thành unsigned 32-bit, chia 2^32 → [0,1)
  return (h >>> 0) / 0xffffffff;
}

/** Bốc một phần tử tất định từ mảng. Mảng rỗng → undefined. */
export function seededPick<T>(items: readonly T[], seed: string, salt: string): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(seededRand(seed, salt) * items.length) % items.length];
}

/** Số nguyên tất định trong [min, max]. */
export function seededInt(seed: string, salt: string, min: number, max: number): number {
  return Math.round(min + seededRand(seed, salt) * (max - min));
}
