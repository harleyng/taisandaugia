import type { ServiceKind, ServiceAudience } from "@/types/orders";

const LABELS: Record<ServiceKind, string> = {
  credit: "Credit",
  direct: "Trực tiếp",
};

const CLASS: Record<ServiceKind, string> = {
  credit: "bg-amber-100 text-amber-700",
  direct: "bg-blue-100 text-blue-700",
};

export function ServiceKindBadge({ kind }: { kind: ServiceKind }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CLASS[kind]}`}>
      {LABELS[kind]}
    </span>
  );
}

// Nhãn tiếng Việt cho nhóm dịch vụ (category).
export const CATEGORY_LABELS: Record<string, string> = {
  package: "Gói credit",
  unlock: "Tính năng credit",
  feature: "Tính năng theo lượt",
  advertising: "Quảng cáo",
};

export const categoryLabel = (c: string | null | undefined): string =>
  (c && CATEGORY_LABELS[c]) || c || "—";

// ─── Đối tượng (audience) ────────────────────────────────────────────────────

export const AUDIENCE_LABELS: Record<ServiceAudience, string> = {
  buyer: "Người mua",
  owner: "Chủ tài sản",
  company: "Công ty đấu giá",
  all: "Dùng chung",
};

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
