import type { SupplierStatus } from "@/types/supplier";

const LABELS: Record<SupplierStatus, string> = {
  active: "Đang hợp tác",
  inactive: "Tạm ngưng",
};

const CLASS: Record<SupplierStatus, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-200 text-gray-600",
};

export function SupplierStatusBadge({ status }: { status: SupplierStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CLASS[status]}`}>
      {LABELS[status]}
    </span>
  );
}

/** Hiển thị trên sàn = có thẻ ở module "Đối tác trên sàn" trỏ về đối tác này.
 *  Quyết định hiển thị nằm bên Nội dung, đây chỉ là chỉ báo đọc. */
export function MarketplaceBadge({ onMarketplace }: { onMarketplace: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        onMarketplace ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {onMarketplace ? "Hiển thị trên sàn" : "Quan hệ ngầm"}
    </span>
  );
}
