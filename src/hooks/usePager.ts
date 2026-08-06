import { useMemo, useState } from "react";

// Phân trang phía CLIENT cho các panel nhúng ở trang chi tiết (công việc /
// ticket của một đối tượng). Danh sách này luôn nhỏ và đã nằm sẵn trong cache
// React Query, nên cắt tại chỗ — không thêm round-trip như bảng phân trang
// server ở báo cáo.

export const PAGE_SIZES = [5, 10, 15, 20, 30, 50];

export interface Pager {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
}

export function usePager<T>(items: T[], initialSize = 5): { paged: T[]; pager: Pager } {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // Kẹp lại thay vì reset: xóa hàng cuối cùng của trang cuối không được nhảy về trang 1.
  const current = Math.min(page, pageCount);

  const paged = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize],
  );

  return {
    paged,
    pager: {
      page: current,
      pageSize,
      pageCount,
      total,
      setPage,
      setPageSize: (s) => { setPageSize(s); setPage(1); },
    },
  };
}
