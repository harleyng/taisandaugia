// Mã tài sản hiển thị trong Trạm Điều Hành (docs/owner-control-tower-plan.md Phase 8).
//
// Bảng listings không có cột mã đọc được ⇒ mã = 8 ký tự hex đầu của listing id,
// in hoa ("3F9A12BC"). Mã hiện ở danh sách tài sản / kết quả để cán bộ chép vào
// file Excel nhập kết quả; lúc nhập, mã được so với các tin ĐANG thuộc danh mục.

const MIN_CODE = 8;

/** "3f9a12bc-…" ⇒ "3F9A12BC". Chịu được id không phải UUID (chỉ giữ chữ + số). */
export function shortAssetId(id: string): string {
  return id.replace(/[^0-9a-z]/gi, "").slice(0, MIN_CODE).toUpperCase();
}

export type AssetIdMatch =
  | { kind: "match"; id: string }
  | { kind: "none" }
  | { kind: "ambiguous" }
  | { kind: "invalid" };

/** "Mã 3F9A12BC", "#3f9a12bc", "3f9a12bc-…-…" ⇒ chuỗi hex thường, không gạch. */
export function normalizeAssetIdInput(raw: string): string {
  return raw
    .trim()
    .replace(/^m[aã]\s*(t[aà]i\s*s[aả]n)?\s*[:#]?\s*/i, "")
    .replace(/[#\s-]/g, "")
    .toLowerCase();
}

/**
 * Tìm tin theo mã người dùng nhập: đủ UUID (có hay không gạch) hoặc tiền tố
 * ≥ 8 ký tự hex, phải trùng DUY NHẤT một tin trong `ids`.
 */
export function matchAssetId(raw: string, ids: readonly string[]): AssetIdMatch {
  const q = normalizeAssetIdInput(raw);
  if (q.length < MIN_CODE || !/^[0-9a-f]+$/.test(q)) return { kind: "invalid" };
  const hits = ids.filter((id) => id.replace(/-/g, "").toLowerCase().startsWith(q));
  if (hits.length === 0) return { kind: "none" };
  if (hits.length > 1) return { kind: "ambiguous" };
  return { kind: "match", id: hits[0] };
}
