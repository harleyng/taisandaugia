import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CONTRACT_STEPS, contractStepIndex, hasConfirmed } from "@/lib/consignment/contractState";
import {
  CONTRACT_SIDE_LABELS,
  type ConsignmentContract,
  type ContractSide,
} from "@/types/consignment-contract";

type StepperContract = Pick<
  ConsignmentContract,
  | "status"
  | "signed_doc_path"
  | "owner_confirmed_at"
  | "org_confirmed_at"
  | "cancel_reason"
  | "cancelled_side"
  | "cancelled_at"
>;

function ConfirmMark({ label, done }: { label: string; done: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 ${done ? "text-success" : "text-muted-foreground"}`}>
      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
      {label}: {done ? "đã xác nhận" : "chưa xác nhận"}
    </span>
  );
}

/** Tiến độ hợp đồng, dùng chung cho chủ tài sản và tổ chức (`viewer` đổi cách xưng hô). */
export function ContractStatusStepper({ contract, viewer }: { contract: StepperContract; viewer: ContractSide }) {
  if (contract.status === "cancelled") {
    const by = contract.cancelled_side
      ? contract.cancelled_side === viewer
        ? "Bạn"
        : CONTRACT_SIDE_LABELS[contract.cancelled_side]
      : "Một bên";
    return (
      <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
        <p className="flex items-center gap-1.5 font-semibold text-destructive">
          <XCircle className="h-4 w-4" /> Hợp đồng đã huỷ
        </p>
        <p className="text-foreground">
          {by} đã huỷ
          {contract.cancelled_at &&
            ` lúc ${format(new Date(contract.cancelled_at), "HH:mm dd/MM/yyyy", { locale: vi })}`}
          {contract.cancel_reason && <>: “{contract.cancel_reason}”</>}
        </p>
      </div>
    );
  }

  const idx = contractStepIndex(contract.status);
  const other: ContractSide = viewer === "owner" ? "org" : "owner";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        {CONTRACT_STEPS.map((s, i) => (
          <div key={s.key} className="flex flex-1 flex-col gap-1.5">
            <div className={`h-1 rounded-full ${i <= idx ? "bg-primary" : "bg-border"}`} />
            <span className={`text-[11px] ${i <= idx ? "font-medium text-foreground" : "text-muted-foreground"}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
      {contract.status === "awaiting_confirmation" && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <ConfirmMark label="Bạn" done={hasConfirmed(contract, viewer)} />
          <ConfirmMark label={CONTRACT_SIDE_LABELS[other]} done={hasConfirmed(contract, other)} />
        </div>
      )}
    </div>
  );
}
