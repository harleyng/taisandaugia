import type { CustomerStatus } from "@/types/advertising";

const LABELS: Record<CustomerStatus, string> = {
  active: "Đang hoạt động",
  inactive: "Ngừng",
};

const CLASS: Record<CustomerStatus, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-200 text-gray-600",
};

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CLASS[status]}`}>
      {LABELS[status]}
    </span>
  );
}
