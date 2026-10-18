import { File, ListChecks, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ContractFileButton } from '@/components/consignment/ContractFileButton'
import { DetailCard, Eyebrow, InfoList, InfoRow, Note } from '@/components/portal/consignment/detail/DetailCard'
import { contractFileName } from '@/lib/consignment/contractFiles'
import { planSummary } from '@/lib/quotePlan'
import type { ContractTerms, OrgContractDetail, OwnerParty } from '@/types/consignment-contract'

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

/**
 * "Bên A — Chủ tài sản": nơi DUY NHẤT tổ chức thấy danh tính, địa chỉ và giấy tờ
 * sở hữu của chủ tài sản (RPC org_consignment_contract — chỉ khi hợp đồng chưa huỷ).
 */
export function ConsignmentOwnerPartyCard({ detail }: { detail: OrgContractDetail }) {
  const assetAddress = detail.asset
    ? [detail.asset.address, detail.asset.ward, detail.asset.district, detail.asset.province].filter(Boolean).join(', ')
    : ''

  return (
    <DetailCard icon={UserRound} title="Bên A — Chủ tài sản">
      {detail.owner_party ? (
        <InfoList>
          <OwnerPartyRows party={detail.owner_party} />
          <InfoRow label="Địa chỉ tài sản" value={assetAddress} />
        </InfoList>
      ) : (
        <p className="text-sm text-muted-foreground">Hợp đồng đã huỷ — thông tin chủ tài sản không còn hiển thị.</p>
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
    </DetailCard>
  )
}

/** Các mốc của phương án đã chốt (chi phí nằm ở thẻ việc tiếp theo). Không có mốc ⇒ không hiện. */
export function ConsignmentPlanCard({ terms, startingPrice }: { terms: ContractTerms; startingPrice: number | null }) {
  const rows = planSummary(terms.plan, startingPrice)
  if (rows.length === 0 && !terms.note) return null
  return (
    <DetailCard icon={ListChecks} title="Phương án đã chốt">
      {rows.length > 0 && (
        <InfoList>
          {rows.map((r) => (
            <InfoRow key={r.label} label={r.label} value={r.value} />
          ))}
        </InfoList>
      )}
      {terms.note && <Note>{terms.note}</Note>}
    </DetailCard>
  )
}
