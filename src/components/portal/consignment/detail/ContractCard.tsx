import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronDown, File, FileSignature, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ContractFileButton } from '@/components/consignment/ContractFileButton'
import { formatVnd } from '@/lib/advertising/slug'
import { planSummary } from '@/lib/quotePlan'
import { isContractOpen } from '@/lib/consignment/contractState'
import { contractFileName } from '@/lib/consignment/contractFiles'
import {
  CONTRACT_STATUS_BADGE_CLASS, CONTRACT_STATUS_LABELS_ORG, type OrgContractDetail, type OwnerParty,
} from '@/types/consignment-contract'
import { DetailCard, Eyebrow, InfoList, InfoRow, Note } from './DetailCard'
import { FeesTable } from './FeesTable'

const idLabel = (t?: string | null) => (t === 'passport' ? 'Hộ chiếu' : 'CCCD')

function OwnerPartyRows({ party }: { party: OwnerParty }) {
  const address = [party.address, party.ward, party.province].filter(Boolean).join(', ')
  if (party.kind === 'organization') {
    return (
      <>
        <InfoRow label="Tổ chức" value={party.org_name} />
        <InfoRow label="Mã số thuế" value={party.tax_code} />
        <InfoRow label="Người đại diện" value={[party.rep_full_name, party.rep_title].filter(Boolean).join(' — ')} />
        <InfoRow label={idLabel(party.rep_id_type)} value={party.rep_id_number} />
        <InfoRow label="Email" value={party.email} />
        <InfoRow label="Địa chỉ trụ sở" value={address} />
      </>
    )
  }
  return (
    <>
      <InfoRow label="Họ và tên" value={party.full_name} />
      <InfoRow label={idLabel(party.id_type)} value={party.id_number} />
      <InfoRow label="Điện thoại" value={party.phone} />
      <InfoRow label="Email" value={party.email} />
      <InfoRow label="Địa chỉ" value={address} />
    </>
  )
}

interface ContractCardProps {
  detail: OrgContractDetail | null | undefined
  isLoading: boolean
  failed: boolean
  startingPrice: number | null
}

/**
 * "Hợp đồng ký gửi" — nơi DUY NHẤT tổ chức thấy danh tính, địa chỉ, giấy tờ sở
 * hữu của chủ tài sản (RPC org_consignment_contract, và chỉ khi hợp đồng chưa
 * huỷ). Nút thao tác nằm ở thanh hành động của banner, không nằm ở đây.
 */
export function ContractCard({ detail, isLoading, failed, startingPrice }: ContractCardProps) {
  const navigate = useNavigate()

  if (isLoading || failed || !detail) {
    return (
      <DetailCard icon={FileSignature} title="Hợp đồng ký gửi">
        {isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải hợp đồng…
          </p>
        ) : (
          <p className="text-sm text-destructive">Không tải được hợp đồng. Vui lòng thử lại.</p>
        )}
      </DetailCard>
    )
  }

  const c = detail.contract
  const t = c.terms
  const assetAddress = detail.asset
    ? [detail.asset.address, detail.asset.ward, detail.asset.district, detail.asset.province].filter(Boolean).join(', ')
    : ''
  const plan = planSummary(t.plan, startingPrice)

  return (
    <DetailCard
      icon={FileSignature}
      title={
        <>
          Hợp đồng ký gửi
          <span className="font-mono text-[13px] font-normal text-muted-foreground">
            {c.code}
            {c.contract_no && ` · Số ${c.contract_no}`}
          </span>
        </>
      }
      aside={
        <span
          className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-medium ${CONTRACT_STATUS_BADGE_CLASS[c.status]}`}
        >
          {CONTRACT_STATUS_LABELS_ORG[c.status]}
        </span>
      }
    >
      {isContractOpen(c) && detail.missing.length > 0 && (
        <Note tone="warning">
          <p className="flex items-start gap-1.5 font-medium">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> Chưa đủ thông tin để lập hợp đồng
          </p>
          {detail.missing.includes('org_legal_rep') && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">Tổ chức chưa khai người đại diện theo pháp luật.</span>
              <Button size="sm" variant="outline" onClick={() => navigate('/portal/nang-luc/thong-tin-chung')}>
                Cập nhật Thông tin chung
              </Button>
            </div>
          )}
          {detail.missing.includes('owner_address') && (
            <p className="mt-2 text-muted-foreground">Đang chờ chủ tài sản bổ sung địa chỉ.</p>
          )}
        </Note>
      )}

      {detail.owner_party && (
        <div className="flex flex-col gap-2.5">
          <Eyebrow>Bên A — Chủ tài sản</Eyebrow>
          <InfoList>
            <OwnerPartyRows party={detail.owner_party} />
            <InfoRow label="Địa chỉ tài sản" value={assetAddress} />
          </InfoList>
        </div>
      )}

      {detail.ownership_doc_paths.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <Eyebrow>Giấy tờ sở hữu</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {detail.ownership_doc_paths.map((p) =>
              p.startsWith('http') ? (
                <Button key={p} size="sm" variant="outline" className="gap-2" onClick={() => window.open(p, '_blank', 'noopener')}>
                  <File className="h-4 w-4" />
                  {contractFileName(p)}
                </Button>
              ) : (
                <ContractFileButton key={p} path={p} bucket="asset-docs" label={contractFileName(p)} icon={File} />
              ),
            )}
          </div>
        </div>
      )}

      {(c.draft_doc_path || c.signed_doc_path) && (
        <div className="flex flex-col gap-2.5">
          <Eyebrow>Tệp hợp đồng</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {c.draft_doc_path && <ContractFileButton path={c.draft_doc_path} label="Dự thảo" />}
            {c.signed_doc_path && <ContractFileButton path={c.signed_doc_path} label="Bản đã ký" />}
          </div>
        </div>
      )}

      <div className="h-px bg-border" />

      <div className="flex flex-col gap-2.5">
        <Eyebrow>Chi phí đã chốt</Eyebrow>
        <FeesTable items={t.fee_items} legacyServiceFee={t.service_fee} />
        <Collapsible>
          <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" />
            Phương án đã chốt
          </CollapsibleTrigger>
          <CollapsibleContent>
            <InfoList className="mt-3">
              <InfoRow label="Thù lao" value={t.commission_pct != null ? `${t.commission_pct}% giá khởi điểm` : null} />
              <InfoRow label="Giá khởi điểm đề xuất" value={t.starting_price != null ? formatVnd(t.starting_price) : null} />
              <InfoRow label="Thời gian dự kiến" value={t.lead_time_days != null ? `${t.lead_time_days} ngày` : null} />
              {plan.map((row) => (
                <InfoRow key={row.label} label={row.label} value={row.value} />
              ))}
            </InfoList>
            {t.note && (
              <div className="mt-3">
                <Note>{t.note}</Note>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </DetailCard>
  )
}
