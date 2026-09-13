// Số học tiền của hợp đồng mua bán — THUẦN, soi gương đúng SQL.
//
// Bản song sinh của `sale_net_paid` / `sale_balance` / `_sale_reallocate` trong
// 20260914000001. Server vẫn là bên quyết định; hàm ở đây để UI hiện số dư và
// tiến độ kỳ hạn mà không phải gọi lại RPC sau mỗi phím bấm. SỬA LUẬT THÌ SỬA
// CẢ HAI BÊN.
//
// Tiền là NUMERIC(18,0) dưới DB. Ở TS tuyệt đối không dùng dấu chấm động cho
// phép cộng dồn: mọi số vào đây đã là số nguyên đồng, và mọi phép tính giữ
// nguyên số nguyên.

export interface MoneyInstallment {
  id?: string;
  seq: number;
  label?: string | null;
  due_at?: string | null;
  amount: number;
}

export interface MoneyPayment {
  amount: number;
  /** Có giá trị ⇒ đây là dòng HOÀN, cộng vào sổ với dấu trừ. */
  reversed_payment_id?: string | null;
}

export interface AllocatedInstallment extends MoneyInstallment {
  paid_amount: number;
  /** Kỳ đã đóng đủ. */
  settled: boolean;
  remaining: number;
}

/** Chuẩn hoá về số nguyên đồng — chặn `"12500000000"` và `12.4` lọt vào phép cộng. */
const toInt = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};

/**
 * Thu RÒNG = Σ(dòng thu) − Σ(dòng hoàn).
 * Dòng hoàn luôn mang `amount > 0`; DẤU nằm ở `reversed_payment_id`.
 */
export function netPaidOf(payments: readonly MoneyPayment[]): number {
  return payments.reduce(
    (sum, p) => sum + (p.reversed_payment_id ? -toInt(p.amount) : toInt(p.amount)),
    0,
  );
}

/** Số còn phải trả = giá − tiền đặt trước đã chuyển thành tiền mua − thu ròng. */
export function balanceOf(
  contract: { price: number; deposit_credit: number },
  payments: readonly MoneyPayment[],
): number {
  return toInt(contract.price) - toInt(contract.deposit_credit) - netPaidOf(payments);
}

/** Tổng phải chia vào các kỳ = giá − tiền đặt trước. */
export function payableOf(contract: { price: number; deposit_credit: number }): number {
  return toInt(contract.price) - toInt(contract.deposit_credit);
}

/**
 * Phân bổ FIFO — TÍNH LẠI TỪ ĐẦU, không cộng dồn.
 *
 * Đây là lý do một bút toán hoàn tự mở lại đúng những kỳ đã đóng mà không cần
 * logic đi ngược: đổ lại toàn bộ `total` vào các kỳ theo thứ tự `seq`.
 */
export function allocateFifo(
  installments: readonly MoneyInstallment[],
  total: number,
): AllocatedInstallment[] {
  let pool = Math.max(toInt(total), 0);
  return [...installments]
    .sort((a, b) => a.seq - b.seq)
    .map((inst) => {
      const amount = toInt(inst.amount);
      const take = Math.min(pool, amount);
      pool -= take;
      return {
        ...inst,
        amount,
        paid_amount: take,
        settled: take >= amount,
        remaining: amount - take,
      };
    });
}

/** Lịch kỳ hạn mặc định lúc lập hợp đồng: một kỳ cho toàn bộ phần còn lại. */
export function defaultInstallments(
  price: number,
  depositCredit: number,
  dueAt: string | null,
): MoneyInstallment[] {
  const amount = toInt(price) - toInt(depositCredit);
  if (amount <= 0) return [];
  return [{ seq: 1, label: "Thanh toán phần còn lại", due_at: dueAt, amount }];
}

/**
 * Chia đều thành `count` kỳ, phần dư dồn vào kỳ CUỐI.
 * Dồn vào kỳ cuối (không phải kỳ đầu) để các kỳ đầu là số tròn dễ đọc.
 */
export function splitEvenly(total: number, count: number): number[] {
  const t = toInt(total);
  const n = Math.max(1, Math.trunc(count));
  if (t <= 0) return [];
  const base = Math.floor(t / n);
  const parts = Array.from({ length: n }, () => base);
  parts[n - 1] += t - base * n;
  return parts.filter((p) => p > 0);
}

/** Σ các kỳ có khớp số phải trả không — kiểm tại chỗ trong hộp thoại điều khoản. */
export function installmentsMatch(
  installments: readonly MoneyInstallment[],
  contract: { price: number; deposit_credit: number },
): boolean {
  const sum = installments.reduce((s, i) => s + toInt(i.amount), 0);
  return sum === payableOf(contract);
}
