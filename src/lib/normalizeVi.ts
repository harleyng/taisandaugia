/**
 * Chuẩn hoá tiếng Việt cho tìm kiếm và khớp từ khoá.
 *
 * Hai mức, đừng lẫn:
 * - `stripViDiacritics` chỉ bỏ dấu + thường hoá, GIỮ nguyên dấu câu — dùng cho ô
 *   tìm `includes` (OrgPicker).
 * - `normalizeVi` / `tokensVi` còn biến mọi ký tự không phải chữ/số thành khoảng
 *   trắng — dùng để khớp cụm từ NGUYÊN TỪ (engine hỏi đáp tài liệu phiên), để
 *   "cọc" không khớp nhầm vào giữa một từ khác.
 */

export function stripViDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();
}

export function normalizeVi(s: string): string {
  return stripViDiacritics(s)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokensVi(s: string): string[] {
  const n = normalizeVi(s);
  return n ? n.split(" ") : [];
}
