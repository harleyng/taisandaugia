// Bộ lọc trang /sessions. Tách khỏi SessionFilterBar để file component chỉ
// export component (react-refresh/only-export-components).

export interface SessionFilters {
  q: string;
  province: string;
  format: string;
  phase: string;
}

export const EMPTY_SESSION_FILTERS: SessionFilters = { q: "", province: "all", format: "all", phase: "all" };

export const hasActiveSessionFilters = (f: SessionFilters) =>
  !!f.q.trim() || f.province !== "all" || f.format !== "all" || f.phase !== "all";
