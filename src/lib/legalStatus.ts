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

/** "Hôm nay" theo giờ Việt Nam (YYYY-MM-DD) — khớp SQL contract_today() của mẫu hợp đồng. */
export function vnTodayStr(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
}

/** Tối thiểu để phân loại phiên bản — dùng chung cho văn bản pháp lý và mẫu hợp đồng. */
export interface VersionedRow {
  id: string;
  effective_date: string;
  created_at?: string | null;
}

/**
 * Gắn trạng thái cho danh sách phiên bản CÙNG một loại (mới nhất trước):
 *  - scheduled: effective_date > hôm nay (chưa áp dụng — force-logout chờ tới ngày này)
 *  - active:    bản có effective_date <= hôm nay mới nhất (đang áp dụng)
 *  - archived:  các bản đã hiệu lực nhưng bị bản mới thay thế
 * Hai bản cùng ngày hiệu lực: bản tạo sau thắng (khớp active_contract_template).
 */
export function classifyLegalVersions<T extends VersionedRow = LegalDocument>(
  versions: T[],
  today: string = todayStr(),
): Array<T & { status: LegalVersionStatus }> {
  const sorted = [...versions].sort(
    (a, b) =>
      b.effective_date.localeCompare(a.effective_date) ||
      (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );
  const activeId = sorted.find((v) => v.effective_date <= today)?.id ?? null;
  return sorted.map((v) => ({
    ...v,
    status: v.effective_date > today ? "scheduled" : v.id === activeId ? "active" : "archived",
  }));
}

/** Trạng thái của MỘT phiên bản, cần danh sách các phiên bản cùng loại để biết bản nào đang active. */
export function legalVersionStatus<T extends VersionedRow = LegalDocument>(
  version: T,
  sameTypeVersions: T[],
  today?: string,
): LegalVersionStatus {
  return (
    classifyLegalVersions(sameTypeVersions, today).find((v) => v.id === version.id)?.status ?? "archived"
  );
}
