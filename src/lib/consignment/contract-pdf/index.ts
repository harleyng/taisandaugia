// Kết xuất dự thảo hợp đồng dịch vụ đấu giá ra PDF.
// Nạp ĐỘNG từ hook (pdfmake + font ~2MB) — chỉ khi tổ chức bấm "Tạo từ báo giá".

import { loadPdfMake } from '@/lib/pdf/pdfmakeRuntime'
import { buildContractDocDefinition } from './document'
import type { ContractPdfInput } from './input'

export async function contractPdfBlob(input: ContractPdfInput): Promise<Blob> {
  const pdfMake = await loadPdfMake()
  return pdfMake.createPdf(buildContractDocDefinition(input)).getBlob()
}
