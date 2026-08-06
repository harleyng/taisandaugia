import { supabase } from '@/integrations/supabase/client'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'

const BUCKET = 'org-documents'

/**
 * Đường dẫn PHẢI bắt đầu bằng organization_id.
 *
 * Trước đây segment đầu là hằng 'default' cho mọi tổ chức, và policy của bucket
 * chỉ kiểm `auth.uid() IS NOT NULL` — nghĩa là ai đăng nhập cũng đọc/ghi/xoá
 * được file của mọi tổ chức. Migration 20260806000030 đổi policy sang gate theo
 * organization_id lấy từ segment đầu, nên prefix 'default' nay bị TỪ CHỐI.
 */
export function buildStoragePath(
  organizationId: string,
  docId: string,
  version: number,
  filename: string,
): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${organizationId}/${docId}/v${version}/${safe}`
}

export async function uploadFile(
  organizationId: string,
  docId: string,
  version: number,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ path: string; error: Error | null }> {
  const path = buildStoragePath(organizationId, docId, version, file.name)

  // For small files (<1MB), skip XHR progress and use SDK directly
  if (file.size < 1024 * 1024) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: true,
    })
    if (!error) onProgress?.(100)
    return { path, error: error ? new Error(error.message) : null }
  }

  // For larger files, use XHR for progress reporting
  return new Promise((resolve) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`
    const xhr = new XMLHttpRequest()

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100)
        resolve({ path, error: null })
      } else {
        resolve({ path, error: new Error(`Upload failed: ${xhr.statusText}`) })
      }
    }

    xhr.onerror = () =>
      resolve({ path, error: new Error('Network error during upload') })

    xhr.open('POST', url)
    xhr.setRequestHeader(
      'apikey',
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    )

    const session = supabase.auth.getSession()
    session.then(({ data }) => {
      if (data.session?.access_token) {
        xhr.setRequestHeader(
          'Authorization',
          `Bearer ${data.session.access_token}`,
        )
      }
      xhr.setRequestHeader('x-upsert', 'true')
      const formData = new FormData()
      formData.append('', file)
      xhr.send(formData)
    })
  })
}

export async function downloadFile(
  path: string,
  downloadAs: string,
): Promise<{ error: Error | null }> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(path)
    if (error) return { error: new Error(error.message) }
    saveAs(data, downloadAs)
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) }
  }
}

export async function deleteFile(
  path: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  return { error: error ? new Error(error.message) : null }
}

export async function getSignedUrl(
  path: string,
  expiresIn = 3600,
): Promise<{ url: string | null; error: Error | null }> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresIn)
  return {
    url: data?.signedUrl ?? null,
    error: error ? new Error(error.message) : null,
  }
}

export async function deleteDocumentAllVersions(
  organizationId: string,
  docId: string,
): Promise<{ error: Error | null }> {
  const prefix = `${organizationId}/${docId}/`
  const { data, error: listErr } = await supabase.storage
    .from(BUCKET)
    .list(`${organizationId}/${docId}`, { limit: 100 })

  if (listErr) return { error: new Error(listErr.message) }

  if (!data || data.length === 0) return { error: null }

  const paths = data.map((f) => `${prefix}${f.name}`)
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  return { error: error ? new Error(error.message) : null }
}

export async function downloadAsZip(
  files: { path: string; filename: string }[],
  zipName: string,
): Promise<{ error: Error | null }> {
  try {
    const zip = new JSZip()
    await Promise.all(
      files.map(async ({ path, filename }) => {
        const { data, error } = await supabase.storage
          .from(BUCKET)
          .download(path)
        if (data) zip.file(filename, data)
        if (error) console.warn(`Bỏ qua ${filename}: ${error.message}`)
      }),
    )
    const blob = await zip.generateAsync({ type: 'blob' })
    saveAs(blob, zipName)
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) }
  }
}
