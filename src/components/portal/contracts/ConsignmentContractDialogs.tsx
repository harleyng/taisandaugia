import { AttachSignedDialog } from '@/components/consignment/AttachSignedDialog'
import { ConfirmSignedDialog } from '@/components/consignment/ConfirmSignedDialog'
import { CancelContractDialog } from '@/components/consignment/CancelContractDialog'
import { CHILD_NAME } from '@/constants/category.constants'
import {
  useAttachSignedContract, useCancelContract, useConfirmContract, useShareContractDraft,
} from '@/hooks/useConsignmentContract'
import type { OrgContractDetail } from '@/types/consignment-contract'
import { ShareDraftDialog } from '../ShareDraftDialog'
import type { ContractDialogKind } from './RequestActionBar'

interface ContractDialogsProps {
  detail: OrgContractDetail
  requestId: string
  auctionOrgId: string | null
  open: ContractDialogKind | null
  onClose: () => void
}

/** Bốn hộp thoại hợp đồng mà thanh hành động mở: chia sẻ dự thảo · tải bản ký · xác nhận · huỷ. */
export function ContractDialogs({ detail, requestId, auctionOrgId, open, onClose }: ContractDialogsProps) {
  const ctx = { side: 'org', requestId, auctionOrgId } as const
  const share = useShareContractDraft(ctx)
  const attach = useAttachSignedContract(ctx)
  const confirm = useConfirmContract(ctx)
  const cancel = useCancelContract(ctx)
  const c = detail.contract
  const onOpenChange = (o: boolean) => !o && onClose()

  return (
    <>
      <ShareDraftDialog
        open={open === 'share'}
        onOpenChange={onOpenChange}
        isPending={share.isPending}
        detail={detail}
        categoryLabel={detail.asset ? (CHILD_NAME[detail.asset.child_slug] ?? null) : null}
        hasSigned={!!c.signed_doc_path}
        onSubmit={(v) => share.mutate({ contract: c, ...v }, { onSuccess: onClose })}
      />
      <AttachSignedDialog
        open={open === 'attach'}
        onOpenChange={onOpenChange}
        isPending={attach.isPending}
        defaultContractNo={c.contract_no}
        replacing={!!c.signed_doc_path}
        onSubmit={(v) => attach.mutate({ contract: c, ...v }, { onSuccess: onClose })}
      />
      <ConfirmSignedDialog
        open={open === 'confirm'}
        onOpenChange={onOpenChange}
        isPending={confirm.isPending}
        signedDocPath={c.signed_doc_path}
        signedDate={c.signed_date}
        onConfirm={() =>
          c.signed_doc_path &&
          confirm.mutate({ contractId: c.id, signedDocPath: c.signed_doc_path }, { onSettled: onClose })
        }
      />
      <CancelContractDialog
        open={open === 'cancel'}
        onOpenChange={onOpenChange}
        isPending={cancel.isPending}
        side="org"
        onConfirm={(reason) => cancel.mutate({ contractId: c.id, reason }, { onSuccess: onClose })}
      />
    </>
  )
}
