import type { ServiceKind, ServiceAudience } from "@/types/orders";
import { AUDIENCE_LABELS } from "./serviceLabels";

const LABELS: Record<ServiceKind, string> = {
  credit: "Credit",
  direct: "Trực tiếp",
  commission: "Hoa hồng",
};

const CLASS: Record<ServiceKind, string> = {
  credit: "bg-amber-100 text-amber-700",
  direct: "bg-blue-100 text-blue-700",
  commission: "bg-emerald-100 text-emerald-700",
};

export function ServiceKindBadge({ kind }: { kind: ServiceKind }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CLASS[kind]}`}>
      {LABELS[kind]}
    </span>
  );
}

// Nhãn dùng chung đã chuyển sang ./serviceLabels (file component chỉ xuất component).

const AUDIENCE_CLASS: Record<ServiceAudience, string> = {
  buyer: "bg-sky-100 text-sky-700",
  owner: "bg-violet-100 text-violet-700",
  company: "bg-orange-100 text-orange-700",
  all: "bg-gray-100 text-gray-600",
};

export function AudienceBadge({ audience }: { audience: ServiceAudience }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${AUDIENCE_CLASS[audience]}`}>
      {AUDIENCE_LABELS[audience]}
    </span>
  );
}
