import { STATUS_BADGE_CLASS, STATUS_LABELS } from "@/lib/customers/customerStatus";
import type { CustomerStatus } from "@/types/customers";

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE_CLASS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
