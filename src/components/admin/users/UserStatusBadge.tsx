import type { AccountStatus } from "@/types/adminUser";

const LABELS: Record<AccountStatus, string> = {
  active: "Hoạt động",
  not_activated: "Chưa kích hoạt",
  locked: "Bị khóa",
};

const CLASS: Record<AccountStatus, string> = {
  active: "bg-green-100 text-green-700",
  not_activated: "bg-amber-100 text-amber-700",
  locked: "bg-red-100 text-red-700",
};

export function UserStatusBadge({ status }: { status: AccountStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CLASS[status]}`}>
      {LABELS[status]}
    </span>
  );
}
