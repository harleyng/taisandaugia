import { useMemo, useState } from "react";
import { SaleAssetCard } from "./SaleAssetCard";
import { SaleDocumentsCard } from "./SaleDocumentsCard";
import { SaleHandoverCard } from "./SaleHandoverCard";
import { SalePartiesCard } from "./SalePartiesCard";
import { SalePaymentsCard } from "./SalePaymentsCard";
import { SaleTermsCard } from "./SaleTermsCard";
import { SaleStageStepper } from "./SaleStageStepper";
import { AttachSignedDialog } from "./AttachSignedDialog";
import { CancelSaleDialog } from "./CancelSaleDialog";
import { ConfirmHandoverDialog } from "./ConfirmHandoverDialog";
import { ConfirmSignedDialog } from "./ConfirmSignedDialog";
import { EditTermsDialog } from "./EditTermsDialog";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import { ReversePaymentDialog } from "./ReversePaymentDialog";
import { ScheduleHandoverDialog } from "./ScheduleHandoverDialog";
import { ShareDraftDialog } from "./ShareDraftDialog";
import { TitleTransferDialog } from "./TitleTransferDialog";
import { InfoBox } from "@/components/shared/InfoBox";
import {
  canEditTerms, canRecordPayment, nextStepText, saleOverdueOf,
} from "@/lib/saleContracts/stage";
import { balanceOf } from "@/lib/saleContracts/money";
import {
  useAttachSignedSale, useCancelSaleContract, useConfirmSaleHandover, useConfirmSaleSigned,
  useRecordSalePayment, useReverseSalePayment, useScheduleSaleHandover, useSetSaleTerms,
  useSetSaleTitleTransfer, useShareSaleDraft,
} from "@/hooks/useSaleContracts";
import type {
  SaleContractDetail, SalePayment, SaleSide,
} from "@/types/auction-sale-contract";

type DialogKind =
  | { kind: "share" }
  | { kind: "attach"; side: SaleSide }
  | { kind: "confirm"; side: SaleSide }
  | { kind: "cancel"; side: SaleSide }
  | { kind: "terms" }
  | { kind: "pay" }
  | { kind: "reverse"; payment: SalePayment }
  | { kind: "schedule" }
  | { kind: "handover"; side: SaleSide }
  | { kind: "title" }
  | null;

/**
 * Thân trang chi tiết hợp đồng mua bán — DÙNG CHUNG cho cổng tổ chức, trang
 * người trúng đấu giá và cổng chủ tài sản.
 *
 * Vai của người xem suy từ `can_act` của RPC chứ không từ trang nào gọi: một
 * người có thể đóng nhiều vai cùng lúc (thành viên tổ chức ký thay bên bán ở lô
 * tin đăng, lại còn là bên ký chứng kiến), và server mới là nơi quyết định.
 */
export function SaleContractBody({
  detail, categoryLabel,
}: {
  detail: SaleContractDetail;
  categoryLabel?: string | null;
}) {
  const { contract, installments, payments, can_act: canAct } = detail;
  const [dialog, setDialog] = useState<DialogKind>(null);
  const close = () => setDialog(null);

  const sides = useMemo(
    () => (["buyer", "seller", "org"] as SaleSide[]).filter((s) => canAct[s]),
    [canAct],
  );
  const sessionId = contract.session_id;

  const shareDraft = useShareSaleDraft();
  const attachSigned = useAttachSignedSale();
  const confirmSigned = useConfirmSaleSigned();
  const cancel = useCancelSaleContract();
  const setTerms = useSetSaleTerms();
  const recordPayment = useRecordSalePayment();
  const reversePayment = useReverseSalePayment();
  const scheduleHandover = useScheduleSaleHandover();
  const confirmHandover = useConfirmSaleHandover();
  const setTitle = useSetSaleTitleTransfer();

  const overdue = saleOverdueOf(contract, installments);
  const balance = balanceOf(contract, payments);
  const hasPayments = payments.length > 0;
  const orgSide = sides.find((s) => s === "org");
  const ref = { id: contract.id, organization_id: contract.organization_id };

  return (
    <div className="space-y-6">
      <SaleStageStepper stage={detail.stage} cancelReason={contract.cancel_reason} />

      {contract.status !== "cancelled" && contract.status !== "completed" ? (
        <InfoBox variant={overdue.any ? "amber" : "muted"}>
          {nextStepText(contract)}
          {overdue.sign ? " Đã quá hạn ký hợp đồng." : ""}
          {overdue.payment ? " Có kỳ thanh toán đã quá hạn." : ""}
          {overdue.handover ? " Đã quá hạn bàn giao." : ""}
        </InfoBox>
      ) : null}

      <SaleAssetCard contract={contract} />
      <SalePartiesCard contract={contract} />

      <SaleDocumentsCard
        contract={contract}
        sides={sides}
        onShareDraft={() => setDialog({ kind: "share" })}
        onAttachSigned={(side) => setDialog({ kind: "attach", side })}
        onConfirm={(side) => setDialog({ kind: "confirm", side })}
        onCancel={(side) => setDialog({ kind: "cancel", side })}
      />

      <SaleTermsCard
        contract={contract}
        canEdit={!!orgSide && canEditTerms(contract, orgSide, hasPayments)}
        editBlockedNote={
          hasPayments && orgSide
            ? "Đã có khoản thu trong sổ — hoàn bút toán trước nếu cần đổi lịch kỳ hạn."
            : null
        }
        onEdit={() => setDialog({ kind: "terms" })}
      />

      <SalePaymentsCard
        contract={contract}
        installments={installments}
        payments={payments}
        canRecord={!!orgSide && canRecordPayment(contract, orgSide)}
        isBusy={recordPayment.isPending || reversePayment.isPending}
        onRecord={() => setDialog({ kind: "pay" })}
        onReverse={(p) => setDialog({ kind: "reverse", payment: p })}
      />

      {contract.status === "signed" || contract.status === "completed" ? (
        <SaleHandoverCard
          contract={contract}
          sides={sides}
          onSchedule={() => setDialog({ kind: "schedule" })}
          onConfirm={(side) => setDialog({ kind: "handover", side })}
          onTitleTransfer={() => setDialog({ kind: "title" })}
        />
      ) : null}

      {/* ── Hộp thoại ─────────────────────────────────────────────────────── */}
      <ShareDraftDialog
        open={dialog?.kind === "share"}
        onOpenChange={(v) => !v && close()}
        detail={detail}
        categoryLabel={categoryLabel}
        isPending={shareDraft.isPending}
        replacing={!!contract.signed_doc_path}
        onSubmit={(v) =>
          shareDraft.mutate({ contract: ref, file: v.file, generated: v.generated }, { onSuccess: close })
        }
      />

      <AttachSignedDialog
        open={dialog?.kind === "attach"}
        onOpenChange={(v) => !v && close()}
        isPending={attachSigned.isPending}
        defaultContractNo={contract.contract_no}
        replacing={!!contract.signed_doc_path}
        onSubmit={(v) =>
          dialog?.kind === "attach" &&
          attachSigned.mutate(
            {
              contract: ref, side: dialog.side, file: v.file,
              signedDate: v.signedDate, contractNo: v.contractNo || null, confirm: v.confirm,
            },
            { onSuccess: close },
          )
        }
      />

      <ConfirmSignedDialog
        open={dialog?.kind === "confirm"}
        onOpenChange={(v) => !v && close()}
        side={dialog?.kind === "confirm" ? dialog.side : "buyer"}
        signedDocPath={contract.signed_doc_path}
        isPending={confirmSigned.isPending}
        onConfirm={() =>
          dialog?.kind === "confirm" &&
          contract.signed_doc_path &&
          confirmSigned.mutate(
            { contractId: contract.id, side: dialog.side, signedDocPath: contract.signed_doc_path },
            { onSuccess: close },
          )
        }
      />

      <CancelSaleDialog
        open={dialog?.kind === "cancel"}
        onOpenChange={(v) => !v && close()}
        side={dialog?.kind === "cancel" ? dialog.side : "org"}
        isPending={cancel.isPending}
        isSigned={contract.status === "signed"}
        onSubmit={(v) =>
          dialog?.kind === "cancel" &&
          cancel.mutate(
            { contractId: contract.id, side: dialog.side, kind: v.kind, reason: v.reason, sessionId },
            { onSuccess: close },
          )
        }
      />

      <EditTermsDialog
        open={dialog?.kind === "terms"}
        onOpenChange={(v) => !v && close()}
        contract={contract}
        installments={installments}
        isPending={setTerms.isPending}
        onSubmit={(v) =>
          setTerms.mutate(
            {
              contractId: contract.id,
              installments: v.installments,
              payeeSide: v.payeeSide,
              payeeBankInfo: v.payeeBankInfo || null,
              contractNo: v.contractNo || null,
              signDueAt: v.signDueAt,
              handoverDueAt: v.handoverDueAt,
              notarizationRequired: v.notarizationRequired,
              orgSigns: v.orgSigns,
            },
            { onSuccess: close },
          )
        }
      />

      <RecordPaymentDialog
        open={dialog?.kind === "pay"}
        onOpenChange={(v) => !v && close()}
        balance={balance}
        unsigned={contract.status !== "signed" && contract.status !== "completed"}
        isPending={recordPayment.isPending}
        onSubmit={async (v) => {
          const { uploadSaleFile } = await import("@/hooks/useSaleContracts");
          const evidencePath = v.file ? await uploadSaleFile(ref, "receipt", v.file) : null;
          recordPayment.mutate(
            {
              contractId: contract.id, amount: v.amount, method: v.method,
              txnRef: v.txnRef || null, receivedAt: v.receivedAt || null,
              evidencePath, note: v.note || null, sessionId,
            },
            { onSuccess: close },
          );
        }}
      />

      <ReversePaymentDialog
        open={dialog?.kind === "reverse"}
        onOpenChange={(v) => !v && close()}
        amount={dialog?.kind === "reverse" ? Number(dialog.payment.amount) : 0}
        isPending={reversePayment.isPending}
        onSubmit={(reason) =>
          dialog?.kind === "reverse" &&
          reversePayment.mutate(
            { paymentId: dialog.payment.id, reason, sessionId },
            { onSuccess: close },
          )
        }
      />

      <ScheduleHandoverDialog
        open={dialog?.kind === "schedule"}
        onOpenChange={(v) => !v && close()}
        defaultAt={contract.handover_scheduled_at}
        defaultLocation={contract.handover_location}
        isPending={scheduleHandover.isPending}
        onSubmit={(v) =>
          scheduleHandover.mutate(
            { contractId: contract.id, handoverAt: v.handoverAt, location: v.location || null },
            { onSuccess: close },
          )
        }
      />

      <ConfirmHandoverDialog
        open={dialog?.kind === "handover"}
        onOpenChange={(v) => !v && close()}
        side={dialog?.kind === "handover" ? dialog.side : "buyer"}
        isPending={confirmHandover.isPending}
        onSubmit={(file) =>
          dialog?.kind === "handover" &&
          confirmHandover.mutate(
            { contract: ref, side: dialog.side, file, sessionId },
            { onSuccess: close },
          )
        }
      />

      <TitleTransferDialog
        open={dialog?.kind === "title"}
        onOpenChange={(v) => !v && close()}
        current={contract.title_transfer_status}
        currentNote={contract.title_transfer_note}
        isPending={setTitle.isPending}
        onSubmit={(v) =>
          setTitle.mutate(
            { contract: ref, status: v.status, note: v.note || null, file: v.file },
            { onSuccess: close },
          )
        }
      />
    </div>
  );
}
