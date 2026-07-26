import type { ProviderStatus } from "@/types/auctionTools";

const LABELS: Record<ProviderStatus, string> = {
  active: "Đang hiển thị",
  inactive: "Tạm ẩn",
};

const CLASS: Record<ProviderStatus, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-200 text-gray-600",
};

export function ProviderStatusBadge({ status }: { status: ProviderStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CLASS[status]}`}>
      {LABELS[status]}
    </span>
  );
}

/** Công cụ nhà (SSCorp) vs đối tác ngoài. */
export function OwnershipBadge({ isOwn }: { isOwn: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isOwn ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-700"
      }`}
    >
      {isOwn ? "Công cụ nhà" : "Đối tác"}
    </span>
  );
}
