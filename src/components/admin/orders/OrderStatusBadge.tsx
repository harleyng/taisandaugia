import type { FulfillmentStatus } from "@/types/orders";

const LABELS: Record<FulfillmentStatus, string> = {
  pending: "Chờ xử lý",
  fulfilled: "Đã trả quyền lợi",
  cancelled: "Đã hủy",
};

const CLASS: Record<FulfillmentStatus, string> = {
  pending: "bg-gray-200 text-gray-600",
  fulfilled: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export function OrderStatusBadge({ status }: { status: FulfillmentStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CLASS[status]}`}>
      {LABELS[status]}
    </span>
  );
}
