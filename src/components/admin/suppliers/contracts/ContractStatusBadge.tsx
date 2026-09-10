import type { ContractDisplayStatus, SupplierContract } from "@/types/supplierContract";
import {
  CONTRACT_STATUS_LABELS,
  contractDisplayStatus,
  daysUntilExpiry,
} from "@/lib/supplierContracts";

const CLASS: Record<ContractDisplayStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-green-100 text-green-700",
  // Cảnh báo, chưa phải lỗi — dùng tông amber như các badge cảnh báo khác.
  expiring: "bg-amber-100 text-amber-700",
  expired: "bg-red-100 text-red-700",
  terminated: "bg-gray-200 text-gray-600",
};

export function ContractStatusBadge({
  contract,
}: {
  contract: Pick<SupplierContract, "status" | "effective_from" | "effective_to">;
}) {
  const display = contractDisplayStatus(contract);
  const left = daysUntilExpiry(contract);
  const label =
    display === "expiring" && left !== null
      ? `Còn ${left} ngày`
      : CONTRACT_STATUS_LABELS[display];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CLASS[display]}`}
      title={CONTRACT_STATUS_LABELS[display]}
    >
      {label}
    </span>
  );
}
