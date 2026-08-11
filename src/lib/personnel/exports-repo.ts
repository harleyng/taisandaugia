// Lịch sử kết xuất hồ sơ nhân sự: bảng personnel_dossier_exports + bucket
// personnel-exports.

import { supabase } from '@/integrations/supabase/client'
import type { Database } from '@/integrations/supabase/types'
import {
  normalizeSections, type DossierSectionId, type DossierTemplate,
} from './dossier-templates'
import type { DossierExportFormat } from './export-dossier'

type Row = Database['public']['Tables']['personnel_dossier_exports']['Row']

export const EXPORTS_BUCKET = 'personnel-exports'

export interface DossierExport {
  id: string
  organizationId: string
  auctioneerId: string | null
  auctioneerName: string
  licenseNumber: string | null
  template: DossierTemplate
  /** Mục đã chọn lúc xuất. NULL ở bản ghi cũ nghĩa là đủ mọi mục. */
  sections: DossierSectionId[] | null
  format: DossierExportFormat
  filePath: string | null
  fileSizeBytes: number | null
  creditsCharged: number
  generatedAt: string
}

function rowTo(r: Row): DossierExport {
  return {
    id: r.id,
    organizationId: r.organization_id,
    auctioneerId: r.auctioneer_id,
    auctioneerName: r.auctioneer_name,
    licenseNumber: r.license_number,
    template: r.template as DossierTemplate,
    sections: r.sections ? normalizeSections(r.sections) : null,
    format: r.format as DossierExportFormat,
    filePath: r.file_path,
    fileSizeBytes: r.file_size_bytes,
    creditsCharged: r.credits_charged,
    generatedAt: r.generated_at,
  }
}

export async function listExports(organizationId: string): Promise<DossierExport[]> {
  const { data, error } = await supabase
    .from('personnel_dossier_exports')
    .select('*')
    .eq('organization_id', organizationId)
    .order('generated_at', { ascending: false })
  if (error) throw error
  return (data as Row[]).map(rowTo)
}

export interface RecordExportInput {
  organizationId: string
  auctioneerId: string
  auctioneerName: string
  licenseNumber?: string | null
  template: DossierTemplate
  sections: DossierSectionId[]
  format: DossierExportFormat
  blob: Blob
  fileName: string
  creditsCharged: number
  generatedBy: string
}

/**
 * Đẩy file lên Storage rồi ghi một dòng lịch sử.
 *
 * Upload hỏng KHÔNG được làm mất bản ghi: người dùng đã bị trừ credit và đã
 * nhận file tải về, nên vẫn ghi dòng lịch sử với file_path = null và đánh dấu
 * là không tải lại được, thay vì để giao dịch biến mất khỏi danh sách.
 */
export async function recordExport(input: RecordExportInput): Promise<void> {
  const exportId = crypto.randomUUID()
  const ext = input.format === 'PDF' ? 'pdf' : 'docx'
  const path = `${input.organizationId}/${exportId}.${ext}`

  let filePath: string | null = null
  try {
    const { error } = await supabase.storage
      .from(EXPORTS_BUCKET)
      .upload(path, input.blob, {
        contentType:
          input.format === 'PDF'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
    if (!error) filePath = path
  } catch {
    filePath = null
  }

  const { error } = await supabase.from('personnel_dossier_exports').insert({
    id: exportId,
    organization_id: input.organizationId,
    auctioneer_id: input.auctioneerId,
    auctioneer_name: input.auctioneerName,
    license_number: input.licenseNumber ?? null,
    template: input.template,
    sections: input.sections,
    format: input.format,
    file_path: filePath,
    file_size_bytes: input.blob.size,
    credits_charged: input.creditsCharged,
    generated_by: input.generatedBy,
  })
  if (error) throw error
}

/**
 * URL ký tạm cho file đã xuất.
 *
 * `downloadAs` đặt Content-Disposition: attachment ⇒ trình duyệt tải xuống
 * thay vì mở tab. Bỏ trống thì file mở inline — cần thế để nhúng PDF vào
 * khung xem trước.
 */
export async function getExportUrl(
  path: string,
  downloadAs?: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(EXPORTS_BUCKET)
    .createSignedUrl(path, 3600, downloadAs ? { download: downloadAs } : undefined)
  if (error) return null
  return data.signedUrl
}

export async function deleteExport(id: string, filePath: string | null): Promise<void> {
  if (filePath) {
    try { await supabase.storage.from(EXPORTS_BUCKET).remove([filePath]) } catch { /* best-effort */ }
  }
  const { error } = await supabase.from('personnel_dossier_exports').delete().eq('id', id)
  if (error) throw error
}
