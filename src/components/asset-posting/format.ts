// Định dạng số tiền cho wizard số hoá — nhóm 3 chữ số bằng dấu phẩy (quy ước tiền của dự án).

export const groupNumber = (s: string | number): string => {
  const digits = String(s).replace(/[^\d]/g, "");
  return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";
};

export const parseNumber = (s: string): string => s.replace(/[^\d]/g, "");

export function vnWords(s: string | number): string {
  const n = Number(String(s).replace(/[^\d]/g, ""));
  if (!n) return "";
  if (n >= 1e9) return `${(n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ đồng`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} triệu đồng`;
  return `${n.toLocaleString("vi-VN")} đồng`;
}
