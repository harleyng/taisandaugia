// slugify tiếng Việt (bỏ dấu, đ→d) — dùng cho ad_pages.slug và ad_positions.code.
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// Tách nhóm 3 chữ số bằng dấu phẩy (5000000 → "5,000,000"). Numeric của Postgres
// có thể về dưới dạng string nên coerce.
export function groupNumber(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "";
}

// Lấy số nguyên từ chuỗi người dùng gõ (bỏ mọi ký tự không phải chữ số).
export function parseNumber(input: string): number {
  return Number(input.replace(/[^\d]/g, "")) || 0;
}

// Định dạng tiền VND — luôn tách nhóm 3 chữ số bằng dấu phẩy.
export function formatVnd(value: number | string | null | undefined): string {
  return `${groupNumber(value)}₫`;
}
