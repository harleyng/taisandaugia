export type TaxRecordType = 'CIT' | 'NSNN'

export const TAX_RECORD_TYPE_LABELS: Record<TaxRecordType, string> = {
  CIT: 'Thuế TNDN (Thu Nhập Doanh Nghiệp)',
  NSNN: 'Khoản nộp Ngân sách Nhà nước',
}

export type DocType = 'TAX_RETURN' | 'TAX_RECEIPT' | 'AUDIT_REPORT' | 'OTHER'

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  TAX_RETURN: 'Tờ khai quyết toán thuế',
  TAX_RECEIPT: 'Biên lai nộp thuế',
  AUDIT_REPORT: 'Báo cáo kiểm toán',
  OTHER: 'Khác',
}

export interface SupportingDocument {
  docId: string
  docType: DocType
  fileName: string
}

export interface TaxRecord {
  id: string
  year: number
  recordType: TaxRecordType
  amount: number            // Raw VND, đã trừ VAT
  vatExcluded: boolean      // User confirmation — bắt buộc tick
  isFinalized: boolean
  finalizedDate?: string
  supportingDocuments: SupportingDocument[]
  notes?: string
  isDeleted: boolean        // Soft delete
  createdAt: string
  updatedAt: string
  scoreContribution: number // Computed: 0 | 1 | 2 | 3
}
