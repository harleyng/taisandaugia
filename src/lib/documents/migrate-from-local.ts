// Di trú MỘT LẦN metadata tủ tài liệu từ localStorage sang Supabase.
//
// Chạy nền khi user mở tủ tài liệu lần đầu sau khi cập nhật. Không xoá dữ liệu
// localStorage: nếu di trú lỗi giữa đường thì lần sau vẫn thử lại được, và
// người dùng không mất gì.
//
// ⚠️ GIỚI HẠN THẬT, cần nói rõ: chỉ metadata nằm ở localStorage. Các FILE thì
// nằm trên Storage dưới prefix 'default/…' cũ, mà policy mới gate theo
// organization_id nên prefix đó bị từ chối. Tại thời điểm di trú bucket
// 'org-documents' có 0 object, nên thực tế không có file nào để mất — nhưng nếu
// một trình duyệt nào đó còn metadata thì bản ghi tạo ra sẽ trỏ tới file không
// tồn tại. Ta vẫn tạo bản ghi (để user thấy mình từng có gì) và đếm riêng số
// bản ghi thiếu file để báo cáo, thay vì âm thầm bỏ đi.

import type { Document, Folder } from '@/types/document'
import * as repo from './supabase-repo'

const FOLDERS_KEY = 'tsd:folders'
const DOCUMENTS_KEY = 'tsd:documents'
const DOC_KEY = (id: string) => `tsd:documents:${id}`
const DONE_KEY = (organizationId: string) => `tsd:documents-migrated:${organizationId}`

export interface MigrationResult {
  ran: boolean
  folders: number
  documents: number
  /** Bản ghi có storagePath theo prefix 'default/' cũ ⇒ file không đọc được. */
  documentsWithUnreachableFile: number
  errors: string[]
}

const EMPTY: MigrationResult = {
  ran: false,
  folders: 0,
  documents: 0,
  documentsWithUnreachableFile: 0,
  errors: [],
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** File nằm ngoài prefix organization_id thì policy bucket mới sẽ từ chối. */
function isUnreachable(storagePath: string, organizationId: string): boolean {
  return !storagePath.startsWith(`${organizationId}/`)
}

export function hasLocalData(): boolean {
  const folders = readJson<Folder[]>(FOLDERS_KEY) ?? []
  const docs = readJson<{ id: string }[]>(DOCUMENTS_KEY) ?? []
  return folders.length > 0 || docs.length > 0
}

export async function migrateDocumentsFromLocal(
  organizationId: string,
): Promise<MigrationResult> {
  if (!organizationId) return EMPTY
  try {
    if (localStorage.getItem(DONE_KEY(organizationId))) return EMPTY
  } catch {
    // localStorage bị chặn ⇒ cũng không có dữ liệu cũ để di trú.
    return EMPTY
  }
  if (!hasLocalData()) {
    try {
      localStorage.setItem(DONE_KEY(organizationId), new Date().toISOString())
    } catch {
      /* bỏ qua */
    }
    return EMPTY
  }

  const result: MigrationResult = { ...EMPTY, ran: true, errors: [] }

  // ── Thư mục: ghi theo thứ tự CHA TRƯỚC CON, vì parent_id có khoá ngoại ──────
  const localFolders = readJson<Folder[]>(FOLDERS_KEY) ?? []
  const byDepth = [...localFolders].sort((a, b) => {
    const depth = (f: Folder) => {
      let d = 0
      let cur: Folder | undefined = f
      while (cur?.parentId) {
        cur = localFolders.find((x) => x.id === cur!.parentId)
        d++
        if (d > 50) break // dữ liệu cũ có thể có chu trình — chặn lặp vô hạn
      }
      return d
    }
    return depth(a) - depth(b)
  })

  for (const folder of byDepth) {
    try {
      await repo.upsertFolder(folder, organizationId)
      result.folders++
    } catch (e) {
      result.errors.push(`Thư mục "${folder.name}": ${e instanceof Error ? e.message : 'lỗi'}`)
    }
  }

  // ── Tài liệu ───────────────────────────────────────────────────────────────
  const index = readJson<{ id: string }[]>(DOCUMENTS_KEY) ?? []
  for (const { id } of index) {
    const doc = readJson<Document>(DOC_KEY(id))
    if (!doc) continue
    try {
      await repo.saveDocument(doc, organizationId)
      result.documents++
      if (isUnreachable(doc.storagePath ?? '', organizationId)) {
        result.documentsWithUnreachableFile++
      }
    } catch (e) {
      result.errors.push(
        `Tài liệu "${doc.displayName}": ${e instanceof Error ? e.message : 'lỗi'}`,
      )
    }
  }

  // Chỉ đóng dấu ĐÃ XONG khi không có lỗi nào; còn lỗi thì để lần sau thử lại
  // phần còn thiếu (mọi thao tác ghi ở trên đều là upsert theo id nên chạy lại
  // không nhân đôi dữ liệu).
  if (result.errors.length === 0) {
    try {
      localStorage.setItem(DONE_KEY(organizationId), new Date().toISOString())
    } catch {
      /* bỏ qua */
    }
  }

  return result
}
