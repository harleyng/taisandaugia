// Đọc số thành chữ tiếng Việt cho biên bản đấu giá.
//
// Văn bản pháp lý ghi tiền theo lệ "số (bằng chữ)": "6.450.000.000 đồng (sáu tỷ
// bốn trăm năm mươi triệu đồng)". Không tái dùng priceInWords ở
// src/lib/assetBrief.ts — hàm đó rút gọn thành "6,45 tỷ đồng", tiện cho thẻ tin
// nhưng không phải văn phong văn bản và làm tròn mất số lẻ.
//
// Các chỗ dễ sai, đều có test:
//   • 15 là "mười lăm" (không phải "mười năm"), 25 là "hai mươi lăm".
//   • 21 là "hai mươi mốt" (không phải "hai mươi một").
//   • 105 là "một trăm linh năm" — hàng chục bằng 0 mà hàng đơn vị khác 0.
//   • 1.000.000.000.000 là "một nghìn tỷ": nhóm "tỷ" lặp lại, không có đơn vị mới.

const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];

/** Đọc một nhóm 3 chữ số. `full` = có nhóm lớn hơn đứng trước ⇒ phải đọc đủ "không trăm". */
function readGroup(n: number, full: boolean): string {
  const tram = Math.floor(n / 100);
  const chuc = Math.floor((n % 100) / 10);
  const donvi = n % 10;
  const out: string[] = [];

  if (tram > 0 || full) out.push(`${DIGITS[tram]} trăm`);

  if (chuc === 0) {
    // "một trăm linh năm" — chỉ chèn "linh" khi thật sự có hàng trăm đứng trước.
    if (donvi > 0 && (tram > 0 || full)) out.push("linh", DIGITS[donvi]);
    else if (donvi > 0) out.push(DIGITS[donvi]);
  } else if (chuc === 1) {
    out.push("mười");
    if (donvi === 5) out.push("lăm");
    else if (donvi > 0) out.push(DIGITS[donvi]);
  } else {
    out.push(`${DIGITS[chuc]} mươi`);
    if (donvi === 1) out.push("mốt");
    else if (donvi === 5) out.push("lăm");
    else if (donvi > 0) out.push(DIGITS[donvi]);
  }

  return out.join(" ");
}

const SCALES = ["", " nghìn", " triệu", " tỷ"];

/**
 * Số nguyên không âm thành chữ, không kèm đơn vị tiền.
 * Trên 10^12 thì nhóm "tỷ" lặp lại ("một nghìn tỷ", "một triệu tỷ").
 */
export function docSoThanhChu(value: number): string {
  const n = Math.round(Math.abs(value));
  if (!Number.isFinite(n) || n === 0) return "không";

  // Cắt thành các nhóm 3 chữ số, nhóm nhỏ nhất trước.
  const groups: number[] = [];
  for (let rest = n; rest > 0; rest = Math.floor(rest / 1000)) groups.push(rest % 1000);

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const g = groups[i];
    // Nhóm 0 vẫn phải đọc bậc "tỷ" nếu còn nhóm phía sau (1.000.000.000.000).
    if (g === 0) {
      if (i > 0 && i % 3 === 0) parts.push("tỷ");
      continue;
    }
    // Nhóm không phải nhóm cao nhất thì đọc đủ ba hàng: "hai tỷ không trăm ba mươi triệu".
    parts.push(readGroup(g, i < groups.length - 1) + SCALES[i % 3]);
    if (i > 0 && i % 3 === 0) parts.push("tỷ");
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** "sáu tỷ bốn trăm năm mươi triệu đồng" — dạng dùng trong biên bản. */
export function tienBangChu(value: number): string {
  return `${docSoThanhChu(value)} đồng`;
}
