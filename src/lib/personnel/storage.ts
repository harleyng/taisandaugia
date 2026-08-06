// Tải file hồ sơ nhân sự.
//
// Đường dẫn theo TỔ CHỨC: {organization_id}/{auctioneer_id}/{uuid}.{ext}
// — khác quy ước {userId}/ của bucket kyc-ekyc/asset-docs, vì hồ sơ nhân sự
// thuộc về tổ chức: hai thành viên cùng quản roster đều phải đọc/ghi được.
// Policy trong migration 20260805000031 khớp đúng quy ước này.

import { supabase } from '@/integrations/supabase/client'

export const DOCS_BUCKET = 'personnel-docs'
export const PORTRAITS_BUCKET = 'personnel-portraits'

export const MAX_DOC_BYTES = 10 * 1024 * 1024
export const MAX_PORTRAIT_BYTES = 5 * 1024 * 1024

function buildPath(organizationId: string, auctioneerId: string, file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  return `${organizationId}/${auctioneerId}/${crypto.randomUUID()}.${ext}`
}

/** Giấy tờ → bucket private, TRẢ VỀ PATH (resolve bằng signed URL lúc hiển thị). */
export async function uploadDocFile(
  organizationId: string,
  auctioneerId: string,
  file: File,
): Promise<string> {
  const path = buildPath(organizationId, auctioneerId, file)
  const { error } = await supabase.storage.from(DOCS_BUCKET).upload(path, file)
  if (error) throw error
  return path
}

/** Ảnh chân dung → bucket public, TRẢ VỀ URL (client anon không mint được signed URL). */
export async function uploadPortrait(
  organizationId: string,
  auctioneerId: string,
  file: File,
): Promise<string> {
  const path = buildPath(organizationId, auctioneerId, file)
  const { error } = await supabase.storage
    .from(PORTRAITS_BUCKET)
    .upload(path, file, { upsert: true })
  if (error) throw error
  return supabase.storage.from(PORTRAITS_BUCKET).getPublicUrl(path).data.publicUrl
}

export async function getDocSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(path, expiresIn)
  if (error) return null
  return data.signedUrl
}

export async function deleteDocFile(path: string): Promise<void> {
  await supabase.storage.from(DOCS_BUCKET).remove([path])
}
