// Chuyển đổi giữa dòng DB và type dùng trong UI.
//
// Tách khỏi repo để test được mà không cần Supabase: đây là chỗ dễ sai âm thầm
// nhất (snake_case ↔ camelCase, DATE ↔ string, NULL ↔ undefined), và sai thì
// không có exception nào — chỉ là một field hiển thị trống.

import type { Tables, TablesInsert } from '@/integrations/supabase/types'
import type {
  Document,
  DocumentVersion,
  Folder,
  LinkedEntity,
  LinkedEntityType,
  MimeCategory,
} from '@/types/document'

export type FolderRow = Tables<'org_document_folders'>
export type DocumentRow = Tables<'org_documents'>
export type VersionRow = Tables<'org_document_versions'>
export type LinkRow = Tables<'org_document_links'>

/**
 * Cột nullable của Postgres về `undefined` chứ không phải `null`.
 * Type phía UI khai `deletedAt?: string` — nếu trả về null thì `!doc.deletedAt`
 * vẫn đúng nhưng `'deletedAt' in doc` lại thành true, và JSON.stringify sinh ra
 * `"deletedAt": null` làm lệch so sánh trong test/snapshot.
 */
const orUndef = (v: string | null): string | undefined => v ?? undefined

// ─── Thư mục ─────────────────────────────────────────────────────────────────

export function rowToFolder(row: FolderRow): Folder {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    // UI gọi trường này là `order`; DB dùng `sort_order` vì `order` là từ khoá SQL.
    order: row.sort_order,
    color: orUndef(row.color),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: orUndef(row.deleted_at),
  }
}

export function folderToRow(
  folder: Folder,
  organizationId: string,
): TablesInsert<'org_document_folders'> {
  return {
    id: folder.id,
    organization_id: organizationId,
    name: folder.name,
    parent_id: folder.parentId,
    sort_order: folder.order,
    color: folder.color ?? null,
    deleted_at: folder.deletedAt ?? null,
  }
}

// ─── Phiên bản & liên kết ────────────────────────────────────────────────────

export function rowToVersion(row: VersionRow): DocumentVersion {
  return {
    version: row.version,
    storagePath: row.storage_path,
    sizeBytes: Number(row.size_bytes),
    uploadedAt: row.uploaded_at,
  }
}

export function rowToLink(row: LinkRow): LinkedEntity {
  return {
    type: row.entity_type as LinkedEntityType,
    id: row.entity_id,
    label: row.label,
  }
}

// ─── Tài liệu ────────────────────────────────────────────────────────────────

/** Dòng org_documents kèm hai bảng con (nếu truy vấn có join). */
export interface DocumentRowWithChildren extends DocumentRow {
  org_document_versions?: VersionRow[] | null
  org_document_links?: LinkRow[] | null
}

export function rowToDocument(row: DocumentRowWithChildren): Document {
  const versions = (row.org_document_versions ?? [])
    .map(rowToVersion)
    // Sắp tăng dần theo số phiên bản: VersionHistoryPanel dựa vào thứ tự này,
    // còn thứ tự Postgres trả về không có bảo đảm nếu thiếu ORDER BY.
    .sort((a, b) => a.version - b.version)

  return {
    id: row.id,
    folderId: row.folder_id,
    displayName: row.display_name,
    description: orUndef(row.description),
    tags: row.tags ?? [],
    linkedEntities: (row.org_document_links ?? []).map(rowToLink),
    expiryDate: orUndef(row.expiry_date),
    isStarred: row.is_starred,
    versions,
    currentVersion: row.current_version,
    mimeCategory: row.mime_category as MimeCategory,
    originalFilename: row.original_filename,
    // size_bytes là BIGINT ⇒ supabase-js trả về number, nhưng ép tường minh để
    // không phụ thuộc hành vi đó.
    sizeBytes: Number(row.size_bytes),
    storagePath: row.storage_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: orUndef(row.deleted_at),
  }
}

export function documentToRow(
  doc: Document,
  organizationId: string,
): TablesInsert<'org_documents'> {
  return {
    id: doc.id,
    organization_id: organizationId,
    folder_id: doc.folderId,
    display_name: doc.displayName,
    description: doc.description ?? null,
    tags: doc.tags,
    expiry_date: doc.expiryDate ?? null,
    is_starred: doc.isStarred,
    mime_category: doc.mimeCategory,
    original_filename: doc.originalFilename,
    size_bytes: doc.sizeBytes,
    storage_path: doc.storagePath,
    current_version: doc.currentVersion,
    deleted_at: doc.deletedAt ?? null,
  }
}

/** Suy nhóm MIME từ tên file — dùng khi tải lên. */
export function mimeCategoryOf(filename: string): MimeCategory {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'PDF'
  if (['doc', 'docx'].includes(ext)) return 'WORD'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'EXCEL'
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) return 'IMAGE'
  return 'OTHER'
}
