import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, FileSignature, Loader2, Share2, Upload, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ContractStatusStepper } from '@/components/consignment/ContractStatusStepper'
import { ContractTermsCard } from '@/components/consignment/ContractTermsCard'
import { ContractFileButton } from '@/components/consignment/ContractFileButton'
import { AttachSignedDialog } from '@/components/consignment/AttachSignedDialog'
import { ConfirmSignedDialog } from '@/components/consignment/ConfirmSignedDialog'
import { CancelContractDialog } from '@/components/consignment/CancelContractDialog'
import { ShareDraftDialog } from './ShareDraftDialog'
import { useHasOrgPermission } from '@/hooks/useOrgPermissions'
import {
  useAttachSignedContract, useCancelContract, useConfirmContract, useOrgConsignmentContract, useShareContractDraft,
} from '@/hooks/useConsignmentContract'
import {
  canAttachSigned, canCancel, canConfirm, canShareDraft, isContractOpen,
} from '@/lib/consignment/contractState'
import { contractFileName } from '@/lib/consignment/contractFiles'
import {
  CONTRACT_STATUS_BADGE_CLASS, CONTRACT_STATUS_LABELS_ORG, type ConsignmentContract, type OwnerParty,
} from '@/types/consignment-contract'
import type { OrgServiceRequest } from '@/types/consignment'
import { ASSET_CATEGORIES } from '@/constants/category.constants'

const CHILD_LABEL: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.flatMap((p) => p.children.map((ch) => [ch.slug, ch.name])),
)

type DialogKind = 'share' | 'attach' | 'confirm' | 'cancel' | null

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

function OwnerPartyRows({ party }: { party: OwnerParty }) {
  const idLabel = (t?: string | null) => (t === 'passport' ? 'Hộ chiếu' : 'CCCD')
  const address = [party.address, party.ward, party.province].filter(Boolean).join(', ')
  if (party.kind === 'organization') {
    return (
      <>
        <Row label="Tổ chức" value={party.org_name} />
        <Row label="Mã số thuế" value={party.tax_code} />
        <Row label="Người đại diện" value={[party.rep_full_name, party.rep_title].filter(Boolean).join(' — ')} />
        <Row label={idLabel(party.rep_id_type)} value={party.rep_id_number} />
        <Row label="Email" value={party.email} />
        <Row label="Địa chỉ trụ sở" value={address} />
      </>
    )
  }
  return (
    <>
      <Row label="Họ và tên" value={party.full_name} />
      <Row label={idLabel(party.id_type)} value={party.id_number} />
      <Row label="Điện thoại" value={party.phone} />
      <Row label="Email" value={party.email} />
      <Row label="Địa chỉ" value={address} />
    </>
  )
}

function nextStepText(c: ConsignmentContract): string {
  switch (c.status) {
    case 'drafting':
      return 'Soạn dự thảo hợp đồng theo phương án và chi phí đã được chốt, rồi chia sẻ cho chủ tài sản.'
    case 'awaiting_signatures':
      return 'Hai bên ký bản giấy, rồi tải bản đã ký lên để cùng xác nhận.'
    case 'awaiting_confirmation':
      return canConfirm(c, 'org')
        ? 'Mở bản đã ký, kiểm tra và xác nhận.'
        : 'Bạn đã xác nhận. Chờ chủ tài sản xác nhận bản đã ký.'
    case 'signed':
      return 'Hợp đồng có hiệu lực — có thể đưa tài sản vào phiên đấu giá.'
    default:
      return ''
  }
}

interface OrgContractSectionProps {
  request: OrgServiceRequest
  auctionOrgId: string | null
}

/**
 * Hợp đồng dịch vụ theo góc nhìn tổ chức — trong sheet chi tiết yêu cầu đã trúng.
 * Đây là nơi DUY NHẤT tổ chức thấy danh tính, địa chỉ, giấy tờ sở hữu của chủ tài
 * sản (RPC org_consignment_contract, và chỉ khi hợp đồng chưa huỷ).
 */
export function OrgContractSection({ request, auctionOrgId }: OrgContractSectionProps) {
  const navigate = useNavigate()
  const { data: detail, isLoading, error } = useOrgConsignmentContract(request.id)
  const canUpdate = useHasOrgPermission('yeu-cau-ky-gui', 'update')
  const ctx = { side: 'org', requestId: request.id, auctionOrgId } as const
  const share = useShareContractDraft(ctx)
  const attach = useAttachSignedContract(ctx)
  const confirm = useConfirmContract(ctx)
  const cancel = useCancelContract(ctx)
  const [dialog, setDialog] = useState<DialogKind>(null)
  const close = () => setDialog(null)

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Đang tải hợp đồng…
      </p>
    )
  }
  if (error) return <p className="text-sm text-destructive">Không tải được hợp đồng. Vui lòng thử lại.</p>
  if (!detail) return null

  const c = detail.contract
  const open = isContractOpen(c)
  const actor = canUpdate && detail.can_act
  const needsLegalRep = detail.missing.includes('org_legal_rep')
  const needsOwnerAddress = detail.missing.includes('owner_address')
  const assetAddress = detail.asset
    ? [detail.asset.address, detail.asset.ward, detail.asset.district, detail.asset.province].filter(Boolean).join(', ')
    : ''

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <FileSignature className="h-4 w-4 text-primary" /> Hợp đồng dịch vụ
          <span className="font-normal text-muted-foreground">
            {c.code}
            {c.contract_no && ` · Số ${c.contract_no}`}
          </span>
        </h3>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${CONTRACT_STATUS_BADGE_CLASS[c.status]}`}>
          {CONTRACT_STATUS_LABELS_ORG[c.status]}
        </span>
      </div>

      <ContractStatusStepper contract={c} viewer="org" />
      {c.status !== 'cancelled' && (
        <p className="flex items-start gap-1.5 text-sm">
          {c.status === 'signed' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
          {nextStepText(c)}
        </p>
      )}

      {open && detail.missing.length > 0 && (
        <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
          <p className="flex items-start gap-1.5 font-medium">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> Chưa đủ thông tin để lập hợp đồng
          </p>
          {needsLegalRep && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Tổ chức chưa khai người đại diện theo pháp luật.</span>
              <Button size="sm" variant="outline" onClick={() => navigate('/portal/nang-luc/thong-tin-chung')}>
                Cập nhật Thông tin chung
              </Button>
            </div>
          )}
          {needsOwnerAddress && <p className="text-muted-foreground">Đang chờ chủ tài sản bổ sung địa chỉ.</p>}
        </div>
      )}

      {detail.owner_party && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bên A — Chủ tài sản</p>
          <OwnerPartyRows party={detail.owner_party} />
          <Row label="Địa chỉ tài sản" value={assetAddress} />
        </div>
      )}

      {detail.ownership_doc_paths.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Giấy tờ sở hữu</p>
          <div className="flex flex-wrap gap-2">
            {detail.ownership_doc_paths.map((p) =>
              p.startsWith('http') ? (
                <Button key={p} size="sm" variant="outline" onClick={() => window.open(p, '_blank', 'noopener')}>
                  {contractFileName(p)}
                </Button>
              ) : (
                <ContractFileButton key={p} path={p} bucket="asset-docs" label={contractFileName(p)} />
              ),
            )}
          </div>
        </div>
      )}

      {(c.draft_doc_path || c.signed_doc_path) && (
        <div className="flex flex-wrap gap-2">
          {c.draft_doc_path && <ContractFileButton path={c.draft_doc_path} label="Dự thảo" />}
          {c.signed_doc_path && <ContractFileButton path={c.signed_doc_path} label="Bản đã ký" />}
        </div>
      )}

      <Separator />
      <ContractTermsCard terms={c.terms} startingPrice={request.starting_price} />

      {open && actor && (
        <div className="flex flex-wrap gap-2">
          {canConfirm(c, 'org') && (
            <Button size="sm" onClick={() => setDialog('confirm')} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> Xác nhận bản đã ký
            </Button>
          )}
          {canShareDraft(c, 'org') && (
            <Button
              size="sm"
              variant={c.status === 'drafting' ? 'default' : 'outline'}
              onClick={() => setDialog('share')}
              className="gap-2"
            >
              <Share2 className="h-4 w-4" /> {c.draft_doc_path ? 'Chia sẻ dự thảo mới' : 'Chia sẻ dự thảo'}
            </Button>
          )}
          {canAttachSigned(c) && (
            <Button size="sm" variant="outline" onClick={() => setDialog('attach')} className="gap-2">
              <Upload className="h-4 w-4" /> {c.signed_doc_path ? 'Tải bản đã ký khác' : 'Tải bản đã ký'}
            </Button>
          )}
          {canCancel(c) && (
            <Button size="sm" variant="ghost" onClick={() => setDialog('cancel')} className="gap-2 text-destructive hover:text-destructive">
              <XCircle className="h-4 w-4" /> Huỷ hợp đồng
            </Button>
          )}
        </div>
      )}
      {open && !actor && (
        <p className="text-xs text-muted-foreground">Bạn chỉ có quyền xem hợp đồng này.</p>
      )}

      <ShareDraftDialog
        open={dialog === 'share'}
        onOpenChange={(o) => !o && close()}
        isPending={share.isPending}
        detail={detail}
        categoryLabel={detail.asset ? (CHILD_LABEL[detail.asset.child_slug] ?? null) : null}
        hasSigned={!!c.signed_doc_path}
        onSubmit={(v) => share.mutate({ contract: c, ...v }, { onSuccess: close })}
      />
      <AttachSignedDialog
        open={dialog === 'attach'}
        onOpenChange={(o) => !o && close()}
        isPending={attach.isPending}
        defaultContractNo={c.contract_no}
        replacing={!!c.signed_doc_path}
        onSubmit={(v) => attach.mutate({ contract: c, ...v }, { onSuccess: close })}
      />
      <ConfirmSignedDialog
        open={dialog === 'confirm'}
        onOpenChange={(o) => !o && close()}
        isPending={confirm.isPending}
        signedDocPath={c.signed_doc_path}
        signedDate={c.signed_date}
        onConfirm={() =>
          c.signed_doc_path &&
          confirm.mutate({ contractId: c.id, signedDocPath: c.signed_doc_path }, { onSettled: close })
        }
      />
      <CancelContractDialog
        open={dialog === 'cancel'}
        onOpenChange={(o) => !o && close()}
        isPending={cancel.isPending}
        side="org"
        onConfirm={(reason) => cancel.mutate({ contractId: c.id, reason }, { onSuccess: close })}
      />
    </div>
  )
}
