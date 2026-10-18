// Bộ lọc trang /sessions. Tách khỏi SessionFilterBar để file component chỉ
// export component (react-refresh/only-export-components).

import type { ListBadgeTone } from "./listBadge";

export interface SessionFilters {
  q: string;
  province: string;
  format: string;
  /** "all" hoặc một ListBadgeTone — lọc đúng theo nhãn trên thẻ. */
  phase: string;
}

export const EMPTY_SESSION_FILTERS: SessionFilters = { q: "", province: "all", format: "all", phase: "all" };

export const SESSION_PHASE_FILTERS: { value: ListBadgeTone; label: string }[] = [
  { value: "soon", label: "Sắp mở bán hồ sơ" },
  { value: "open", label: "Đang nhận hồ sơ" },
  { value: "upcoming", label: "Sắp diễn ra" },
  { value: "live", label: "Đang diễn ra" },
  { value: "done", label: "Đã kết thúc" },
];

export const hasActiveSessionFilters = (f: SessionFilters) =>
  !!f.q.trim() || f.province !== "all" || f.format !== "all" || f.phase !== "all";
