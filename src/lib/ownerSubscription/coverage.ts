// Gói thuê bao có bao một thao tác tính credit hay không — dùng để HIỂN THỊ trước khi
// bấm. Quyết định thật nằm ở server (_owner_sub_consume); đây chỉ là bản xem trước.

import { CYCLE_THIS } from "./benefits";
import { SUB_FEATURE_UNITS } from "./status";
import type { BenefitCycle, OwnerSubscriptionStatus, SubVariantKey } from "./types";

export type Coverage =
  /** Gói bao: miễn phí. remaining null = không giới hạn. */
  | { kind: "covered"; remaining: number | null; quota: number | null; cycle: BenefitCycle }
  /** Hết hạn mức và gói đặt chế độ chặn. */
  | { kind: "blocked"; quota: number; cycle: BenefitCycle }
  /** Trả credit. `exhausted` = hết hạn mức gói, đang tính credit theo chế độ trừ credit. */
  | { kind: "credits"; exhausted: boolean; cycle?: BenefitCycle };

const CREDITS: Coverage = { kind: "credits", exhausted: false };

export function coverageFor(
  status: OwnerSubscriptionStatus | null | undefined,
  variantKey: SubVariantKey,
): Coverage {
  if (!status || !status.covered_for_me || status.status !== "active") return CREDITS;
  const line = status.lines.find((l) => l.benefit_key === variantKey && l.source === "enforced");
  if (!line) return CREDITS;
  const cycle = line.cycle ?? "month";
  if (line.quota === null) return { kind: "covered", remaining: null, quota: null, cycle };
  const remaining = Math.max(line.quota - Math.max(line.used, 0), 0);
  if (remaining > 0) return { kind: "covered", remaining, quota: line.quota, cycle };
  return status.overage_mode === "block"
    ? { kind: "blocked", quota: line.quota, cycle }
    : { kind: "credits", exhausted: true, cycle };
}

/** "Còn 3 lượt miễn phí tháng này" / "Miễn phí không giới hạn theo gói dịch vụ". */
export function coverageLabel(coverage: Coverage, variantKey: SubVariantKey): string {
  const unit = SUB_FEATURE_UNITS[variantKey];
  switch (coverage.kind) {
    case "covered":
      return coverage.remaining === null
        ? "Miễn phí không giới hạn theo gói dịch vụ"
        : `Còn ${coverage.remaining} lượt miễn phí ${CYCLE_THIS[coverage.cycle]}`;
    case "blocked":
      return `Đã dùng hết ${coverage.quota} ${unit} của gói ${CYCLE_THIS[coverage.cycle]}`;
    case "credits":
      return coverage.exhausted ? `Đã hết hạn mức gói ${CYCLE_THIS[coverage.cycle ?? "month"]} — tính credit` : "";
  }
}

/** Phần trăm đã dùng cho thanh tiến độ (0–100; không giới hạn ⇒ null). */
export function usagePercent(used: number, quota: number | null): number | null {
  if (quota === null || quota <= 0) return null;
  return Math.min(100, Math.round((Math.max(used, 0) / quota) * 100));
}
