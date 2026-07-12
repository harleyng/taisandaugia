import type { LegalDocument } from "@/types/legal";

export type LegalVersionStatus = "active" | "scheduled" | "archived";

export const LEGAL_STATUS_LABEL: Record<LegalVersionStatus, string> = {
  active: "Đang áp dụng",
  scheduled: "Chờ áp dụng",
  archived: "Đã lưu trữ",
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Gắn trạng thái cho danh sách phiên bản CÙNG một loại (mới nhất trước):
 *  - scheduled: effective_date > hôm nay (chưa áp dụng — force-logout chờ tới ngày này)
 *  - active:    bản có effective_date <= hôm nay mới nhất (đang áp dụng)
 *  - archived:  các bản đã hiệu lực nhưng bị bản mới thay thế
 */
export function classifyLegalVersions(
  versions: LegalDocument[],
): Array<LegalDocument & { status: LegalVersionStatus }> {
  const today = todayStr();
  const sorted = [...versions].sort((a, b) => b.effective_date.localeCompare(a.effective_date));
  const activeId = sorted.find((v) => v.effective_date <= today)?.id ?? null;
  return sorted.map((v) => ({
    ...v,
    status: v.effective_date > today ? "scheduled" : v.id === activeId ? "active" : "archived",
  }));
}

/** Trạng thái của MỘT phiên bản, cần danh sách các phiên bản cùng loại để biết bản nào đang active. */
export function legalVersionStatus(
  version: LegalDocument,
  sameTypeVersions: LegalDocument[],
): LegalVersionStatus {
  return (
    classifyLegalVersions(sameTypeVersions).find((v) => v.id === version.id)?.status ?? "archived"
  );
}
