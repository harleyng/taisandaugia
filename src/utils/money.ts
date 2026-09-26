// Định dạng tiền dùng chung cho Trạm Điều Hành (docs/owner-control-tower-plan.md §A8.3).
// Quy ước: nhóm 3 chữ số bằng DẤU PHẨY, phần thập phân bằng DẤU CHẤM
// ("12.4 tỷ", "12,400,000,000 ₫") — khớp formatVnd/groupNumber, không dùng "vi-VN".

export interface MoneyParts {
  value: string;
  unit: string;
}

const EMPTY: MoneyParts = { value: "—", unit: "" };

/** Làm tròn 1 chữ số thập phân (nhân 10 trước để 1.95 → 2, không thành 1.9 do sai số float). */
const round1 = (n: number) => Math.round(n * 10) / 10;

/** "12" / "12.5" / "1,234.5" — bỏ đuôi ".0", nhóm nghìn bằng dấu phẩy. */
const oneDecimal = (n: number) => round1(n).toLocaleString("en-US", { maximumFractionDigits: 1 });

function toNumber(amount: number | string | null | undefined): number | null {
  if (amount === null || amount === undefined || amount === "") return null;
  const n = Number(amount);
  return Number.isFinite(n) ? n : null;
}

/**
 * Tách số và đơn vị để ô KPI in đơn vị nhỏ, mờ bên cạnh số:
 * ≥ 1 tỷ → "tỷ", ≥ 1 triệu → "tr", nhỏ hơn → số đầy đủ + "₫".
 */
export function moneyShortParts(amount: number | string | null | undefined): MoneyParts {
  const n = toNumber(amount);
  if (n === null) return EMPTY;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  // round1(...) >= 1000: 999,960,000 làm tròn thành "1000 tr" ⇒ in là "1 tỷ".
  if (abs >= 1_000_000_000 || round1(abs / 1_000_000) >= 1000) {
    return { value: sign + oneDecimal(abs / 1_000_000_000), unit: "tỷ" };
  }
  if (abs >= 1_000_000) return { value: sign + oneDecimal(abs / 1_000_000), unit: "tr" };
  return { value: sign + Math.round(abs).toLocaleString("en-US"), unit: "₫" };
}

/** Dạng ngắn một chuỗi: "12.4 tỷ", "850 tr", "500,000 ₫". */
export function formatMoneyShort(amount: number | string | null | undefined): string {
  const { value, unit } = moneyShortParts(amount);
  return unit ? `${value} ${unit}` : value;
}

/** Dạng đầy đủ cho bảng và file xuất: "12,400,000,000 ₫". */
export function formatMoneyFull(amount: number | string | null | undefined): string {
  const n = toNumber(amount);
  if (n === null) return EMPTY.value;
  return `${Math.round(n).toLocaleString("en-US")} ₫`;
}
