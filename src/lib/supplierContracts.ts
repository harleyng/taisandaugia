// Suy trạng thái hiển thị của hợp đồng hợp tác.
//
// "Hết hạn" KHÔNG phải giá trị lưu trong DB (xem 20260907000001): nó là hàm của
// `status` + `effective_to` + ngày hôm nay. Lưu thành cờ thì phải nuôi một cron
// để lật cờ, và cờ sẽ lệch ngay lần quên đầu tiên. Logic sống ở đúng một chỗ để
// badge, bộ lọc và cảnh báo không bao giờ nói khác nhau.

import type {
  ContractDisplayStatus,
  SupplierContract,
} from "@/types/supplierContract";

/** Trong bao nhiêu ngày thì coi là "sắp hết hạn". */
export const EXPIRING_SOON_DAYS = 30;

const DAY_MS = 86_400_000;

/** Số ngày còn lại tới `effective_to`; null = vô thời hạn. */
export function daysUntilExpiry(
  contract: Pick<SupplierContract, "effective_to">,
  today: Date = new Date(),
): number | null {
  if (!contract.effective_to) return null;
  // So sánh theo NGÀY, không theo mốc giờ: hợp đồng hết hạn vào cuối ngày
  // effective_to, nên 23:00 hôm hết hạn vẫn còn hiệu lực.
  const end = new Date(`${contract.effective_to}T00:00:00`);
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end.getTime() - now.getTime()) / DAY_MS);
}

export function contractDisplayStatus(
  contract: Pick<SupplierContract, "status" | "effective_from" | "effective_to">,
  today: Date = new Date(),
): ContractDisplayStatus {
  if (contract.status !== "active") return contract.status;

  const left = daysUntilExpiry(contract, today);
  if (left !== null && left < 0) return "expired";
  if (left !== null && left <= EXPIRING_SOON_DAYS) return "expiring";
  return "active";
}

/** Có đang hiệu lực tại ngày `at` không — soi gương vị từ trong resolve_contract_terms. */
export function isInForce(
  contract: Pick<SupplierContract, "status" | "effective_from" | "effective_to">,
  at: Date = new Date(),
): boolean {
  if (contract.status !== "active") return false;
  const day = at.toISOString().slice(0, 10);
  if (contract.effective_from > day) return false;
  return !contract.effective_to || contract.effective_to >= day;
}

export const CONTRACT_STATUS_LABELS: Record<ContractDisplayStatus, string> = {
  draft: "Nháp",
  active: "Đang hiệu lực",
  expiring: "Sắp hết hạn",
  expired: "Hết hạn",
  terminated: "Đã chấm dứt",
};

/** Mô tả mức hoa hồng cho bảng/badge. */
export function commissionLabel(
  type: "percent" | "fixed" | null | undefined,
  value: number | null | undefined,
  groupNumber: (n: number | string) => string,
): string {
  if (!type || value == null) return "—";
  return type === "percent" ? `${Number(value)}%` : `${groupNumber(value)}₫`;
}
