// Dữ liệu vào của dự thảo hợp đồng dịch vụ đấu giá — dựng CHỈ từ bản chiếu
// hợp đồng (org_consignment_contract), không đọc bảng sống: điều khoản là báo
// giá đã đóng băng lúc chủ tài sản chốt.

import type {
  AssetSnapshot,
  ContractTerms,
  OrgContractDetail,
  OrgParty,
  OwnerParty,
} from '@/types/consignment-contract'

export interface ContractPdfInput {
  code: string | null
  contractNo: string | null
  owner: OwnerParty
  org: OrgParty
  asset: AssetSnapshot
  terms: ContractTerms
  /** Nhãn loại tài sản tra sẵn — không kéo ASSET_CATEGORIES (lucide) vào renderer. */
  categoryLabel: string | null
  generatedAt: Date
}

export function buildContractPdfInput(
  detail: OrgContractDetail,
  opts: { categoryLabel?: string | null; now?: Date } = {},
): ContractPdfInput {
  const { contract, owner_party, asset } = detail
  if (!owner_party || !asset || !contract.org_party) {
    throw new Error('Hợp đồng đã huỷ hoặc thiếu thông tin các bên — không tạo được dự thảo.')
  }
  return {
    code: contract.code,
    contractNo: contract.contract_no,
    owner: owner_party,
    org: contract.org_party,
    asset,
    terms: contract.terms,
    categoryLabel: opts.categoryLabel ?? null,
    generatedAt: opts.now ?? new Date(),
  }
}

export function contractDraftFileName(input: Pick<ContractPdfInput, 'code'>): string {
  return `Du-thao-HDDV_${input.code ?? 'hop-dong'}.pdf`
}
