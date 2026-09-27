import { useMemo } from "react";
import { ConfirmDefaultDialog, type ConfirmDefaultTarget } from "@/components/asset-owner-portal/pulse/ConfirmDefaultDialog";
import type { CashFlowData } from "@/lib/ownerCashFlow";
import type { CanWriteRow, CashDialogState } from "./cashFlowDialogState";
import { CashEventDialog, type CashEventTarget } from "./CashEventDialog";
import { DeleteCashEventDialog } from "./DeleteCashEventDialog";
import { PaymentDueDialog } from "./PaymentDueDialog";

interface CashFlowDialogsProps {
  workspaceId: string;
  data: CashFlowData;
  state: CashDialogState | null;
  canWrite: CanWriteRow;
  onClose: () => void;
}

/** Mọi hộp thoại của trang Thu tiền — một trạng thái, một chỗ. */
export function CashFlowDialogs({ workspaceId, data, state, canWrite, onClose }: CashFlowDialogsProps) {
  // Định danh ổn định theo trạng thái: hộp thoại reset biểu mẫu khi đích ĐỔI, không phải mỗi lần render.
  const eventTarget = useMemo<CashEventTarget | null>(() => {
    if (state?.kind === "record") return { mode: "create", outcomeId: state.outcomeId, presetKind: state.presetKind };
    if (state?.kind === "edit") return { mode: "edit", event: state.event };
    return null;
  }, [state]);
  const defaultTarget = useMemo<ConfirmDefaultTarget | null>(
    () =>
      state?.kind === "default" && state.row.ownOutcomeId
        ? { outcomeId: state.row.ownOutcomeId, title: state.row.title }
        : null,
    [state],
  );

  return (
    <>
      <CashEventDialog workspaceId={workspaceId} data={data} target={eventTarget} canWrite={canWrite} onClose={onClose} />
      <DeleteCashEventDialog
        workspaceId={workspaceId}
        event={state?.kind === "delete" ? state.event : null}
        onClose={onClose}
      />
      <PaymentDueDialog workspaceId={workspaceId} row={state?.kind === "due" ? state.row : null} onClose={onClose} />
      <ConfirmDefaultDialog workspaceId={workspaceId} target={defaultTarget} onClose={onClose} />
    </>
  );
}
