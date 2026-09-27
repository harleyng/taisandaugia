import type { ReactNode } from "react";

/** Hai cột của trang chi tiết: việc + tài liệu | tóm tắt + hoạt động (xếp một cột dưới 1100px). */
export function ContractDetailLayout({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">{main}</div>
      <div className="flex min-w-0 flex-col gap-4">{side}</div>
    </div>
  );
}

/** Nút "Huỷ hợp đồng" dạng liên kết đỏ ở góc trái hàng nút. */
export function CancelLink({ onClick, label = "Huỷ hợp đồng" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 py-1 text-[13px] font-semibold text-destructive hover:text-destructive/80"
    >
      {label}
    </button>
  );
}
