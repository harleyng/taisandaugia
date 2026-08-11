// Kết xuất hồ sơ đấu giá viên.
//
// CHỈ CÒN PDF. Bản DOCX đã bỏ: mẫu "Năng lực" là một layout in A4 (hero nền
// màu tràn lề, lưới thẻ, phụ lục ảnh 3 cột) mà Word không dựng lại được —
// giữ lại chỉ tạo ra một bản xấu hơn hẳn và hai layout phải bảo trì song song.
//
// Dữ liệu vào ở dossier-bundle.ts, mẫu/mục ở dossier-templates.ts; render ở
// dossier-pdf/, nạp động vì pdfmake + font nặng ~2MB.

import { safeFileName, type DossierBundle } from './dossier-bundle'
import { DEFAULT_EXPORT_OPTIONS, type DossierExportOptions } from './dossier-templates'

/** Giữ kiểu để lịch sử xuất cũ (có bản DOCX) vẫn đọc được. */
export type DossierExportFormat = 'PDF' | 'DOCX'
export type { DossierBundle }

export function dossierFileName(fullName: string, _format?: DossierExportFormat): string {
  return `Ho-so-DGV_${safeFileName(fullName)}.pdf`
}

export async function renderDossier(
  b: DossierBundle,
  orgName: string,
  opts: DossierExportOptions = DEFAULT_EXPORT_OPTIONS,
): Promise<Blob> {
  const { dossierPdfBlob } = await import('./dossier-pdf')
  return dossierPdfBlob(b, orgName, opts)
}
