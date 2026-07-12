import type { PartnerStatus } from "@/types/partner";

const LABELS: Record<PartnerStatus, string> = {
  active: "Đang hiển thị",
  inactive: "Ẩn",
};

const CLASS: Record<PartnerStatus, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-200 text-gray-600",
};

export function PartnerStatusBadge({ status }: { status: PartnerStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CLASS[status]}`}>
      {LABELS[status]}
    </span>
  );
}
