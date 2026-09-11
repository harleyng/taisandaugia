// Lắp ráp bản xuất PDF hồ sơ đấu giá viên.
//
// Ba mẫu (theme.ts) × tám mục bật/tắt (dossier-templates.ts). Mục nào không
// được chọn thì KHÔNG dựng — và ngắt trang cũng đi theo, nên bỏ một mục không
// để lại trang trắng.
//
// Chữ: Lora cho tên và số liệu lớn (nạp từ assets), Roboto cho phần còn lại —
// cả hai đều phủ đủ dấu tiếng Việt. Thiết kế gốc dùng Be Vietnam Pro cho thân
// chữ; Roboto thay vào để khỏi gánh thêm một font nữa vào bundle.
//
// Nạp pdfmake + font nằm ở src/lib/pdf/pdfmakeRuntime.ts (dùng chung với dự
// thảo hợp đồng ký gửi).

import type { DossierBundle } from '../dossier-bundle'
import {
  DEFAULT_EXPORT_OPTIONS, type DossierExportOptions,
} from '../dossier-templates'
import { loadPdfMake } from '@/lib/pdf/pdfmakeRuntime'
import { buildDocDefinition } from './document'
import { loadDossierImages, type DossierImages } from './images'

export type { DossierImages }
export { loadDossierImages }

export async function dossierPdfBlob(
  b: DossierBundle,
  orgName: string,
  opts: DossierExportOptions = DEFAULT_EXPORT_OPTIONS,
): Promise<Blob> {
  const [pdfMake, images] = await Promise.all([
    loadPdfMake({ lora: true }),
    loadDossierImages(b),
  ])

  return pdfMake.createPdf(buildDocDefinition(b, orgName, images, opts)).getBlob()
}
