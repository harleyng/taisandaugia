// Gói thuê bao có bao một thao tác tính credit hay không — dùng để HIỂN THỊ trước khi
// bấm. Quyết định thật nằm ở server (_owner_sub_consume); đây chỉ là bản xem trước.

import { SUB_FEATURE_UNITS } from "./status";
import type { OwnerSubscriptionStatus, SubVariantKey } from "./types";

export type Coverage =
  /** Gói bao: miễn phí. remaining null = không giới hạn. */
  | { kind: "covered"; remaining: number | null; quota: number | null }
  /** Hết hạn mức và gói đặt chế độ chặn. */
  | { kind: "blocked"; quota: number }
  /** Trả credit. `exhausted` = hết hạn mức gói, đang tính credit theo chế độ trừ credit. */
  | { kind: "credits"; exhausted: boolean };

const CREDITS: Coverage = { kind: "credits", exhausted: false };

export function coverageFor(
  status: OwnerSubscriptionStatus | null | undefined,
  variantKey: SubVariantKey,
): Coverage {
  if (!status || !status.covered_for_me || status.status !== "active") return CREDITS;
  const line = status.lines.find((l) => l.variant_key === variantKey);
  if (!line) return CREDITS;
  if (line.monthly_quota === null) return { kind: "covered", remaining: null, quota: null };
  const remaining = Math.max(line.monthly_quota - Math.max(line.used, 0), 0);
  if (remaining > 0) return { kind: "covered", remaining, quota: line.monthly_quota };
  return status.overage_mode === "block"
    ? { kind: "blocked", quota: line.monthly_quota }
    : { kind: "credits", exhausted: true };
}

/** "Miễn phí theo gói — còn 3 lượt quét tháng này" / "Không giới hạn theo gói". */
export function coverageLabel(coverage: Coverage, variantKey: SubVariantKey): string {
  const unit = SUB_FEATURE_UNITS[variantKey];
  switch (coverage.kind) {
    case "covered":
      return coverage.remaining === null
        ? "Miễn phí theo gói thuê bao — không giới hạn"
        : `Miễn phí theo gói thuê bao — còn ${coverage.remaining} ${unit} tháng này`;
    case "blocked":
      return `Đã dùng hết ${coverage.quota} ${unit} của gói tháng này`;
    case "credits":
      return coverage.exhausted ? "Đã hết hạn mức gói tháng này — tính credit" : "";
  }
}

/** Phần trăm đã dùng cho thanh tiến độ (0–100; không giới hạn ⇒ null). */
export function usagePercent(used: number, quota: number | null): number | null {
  if (quota === null || quota <= 0) return null;
  return Math.min(100, Math.round((Math.max(used, 0) / quota) * 100));
}
