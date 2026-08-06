// Truy cập bảng org_document* — thay thế src/lib/documents/storage.ts (localStorage).
//
// Tách khỏi hook để useDocuments/useFolders chỉ còn lo React Query + state UI,
// giống cách lib/auctioneers/supabase-repo.ts đã làm.
//
// RLS đã giới hạn theo tổ chức (can_access_org_documents), nên mọi hàm ở đây
// vẫn truyền organization_id tường minh khi GHI — RLS là lưới an toàn, không
// phải cơ chế định tuyến dữ liệu.

import { supabase } from '@/integrations/supabase/client'
import { DEFAULT_FOLDER_NAMES } from '@/types/document'
import type { Document, Folder, LinkedEntity } from '@/types/document'
import type { TablesInsert } from '@/integrations/supabase/types'
import {
  documentToRow,
  folderToRow,
  rowToDocument,
  rowToFolder,
  type DocumentRowWithChildren,
  type FolderRow,
} from './mappers'

// ─── Thư mục ─────────────────────────────────────────────────────────────────

export async function listFolders(organizationId: string): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('org_document_folders')
    .select('*')
    .eq('organization_id', organizationId)
    .order('sort_order', { ascending: true })

  if (error) throw error
  return (data as FolderRow[]).map(rowToFolder)
}

export async function upsertFolder(folder: Folder, organizationId: string): Promise<Folder> {
  const { data, error } = await supabase
    .from('org_document_folders')
    .upsert(folderToRow(folder, organizationId))
    .select()
    .single()

  if (error) throw error
  return rowToFolder(data as FolderRow)
}

/** Đổi thứ tự trong cùng một thư mục cha — ghi hàng loạt trong một lượt. */
export async function reorderFolders(
  orderedIds: string[],
  organizationId: string,
): Promise<void> {
  if (orderedIds.length === 0) return
  // upsert cần đủ cột NOT NULL, nên đọc lại rồi ghi thay vì update từng dòng.
  const { data, error } = await supabase
    .from('org_document_folders')
    .select('*')
    .in('id', orderedIds)
  if (error) throw error

  const byId = new Map((data as FolderRow[]).map((r) => [r.id, r]))
  const rows = orderedIds
    .map((id, i) => {
      const row = byId.get(id)
      return row ? { ...row, sort_order: i } : null
    })
    .filter((r): r is FolderRow => r !== null)

  if (rows.length === 0) return
  const { error: upErr } = await supabase
    .from('org_document_folders')
    .upsert(rows.map((r) => ({ ...r, organization_id: organizationId })))
  if (upErr) throw upErr
}

/**
 * Xoá mềm thư mục VÀ toàn bộ nhánh con.
 *
 * Bản localStorage tự đệ quy trên mảng trong bộ nhớ. Ở đây dùng CTE đệ quy qua
 * RPC thì gọn hơn, nhưng để không thêm RPC cho một việc nhỏ, ta tải cây của tổ
 * chức về rồi tính nhánh con phía client — cây thư mục của một tổ chức luôn nhỏ.
 */
export async function softDeleteFolderTree(
  folderId: string,
  organizationId: string,
): Promise<void> {
  const all = await listFolders(organizationId)
  const ids: string[] = []
  const collect = (id: string) => {
    ids.push(id)
    all.filter((f) => f.parentId === id).forEach((c) => collect(c.id))
  }
  collect(folderId)

  const { error } = await supabase
    .from('org_document_folders')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
}

/** Tạo bộ thư mục mặc định lần đầu. Idempotent: đã có thư mục thì bỏ qua. */
export async function seedDefaultFolders(organizationId: string): Promise<Folder[]> {
  const existing = await listFolders(organizationId)
  if (existing.length > 0) return existing

  const rows = DEFAULT_FOLDER_NAMES.map(
    (name, i): TablesInsert<'org_document_folders'> => ({
      organization_id: organizationId,
      name,
      parent_id: null,
      sort_order: i,
    }),
  )

  const { data, error } = await supabase
    .from('org_document_folders')
    // Ràng buộc UNIQUE (organization_id, parent_id, name) chặn nhân đôi nếu hai
    // tab cùng seed một lúc; ignoreDuplicates để lượt sau không báo lỗi.
    .upsert(rows, { onConflict: 'organization_id,parent_id,name', ignoreDuplicates: true })
    .select()

  if (error) throw error
  return (data as FolderRow[] | null)?.map(rowToFolder) ?? []
}

// ─── Tài liệu ────────────────────────────────────────────────────────────────

const DOC_SELECT = '*, org_document_versions(*), org_document_links(*)'

export async function listDocuments(organizationId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('org_documents')
    .select(DOC_SELECT)
    .eq('organization_id', organizationId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data as DocumentRowWithChildren[]).map(rowToDocument)
}

export async function getDocument(id: string): Promise<Document | null> {
  const { data, error } = await supabase
    .from('org_documents')
    .select(DOC_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data ? rowToDocument(data as DocumentRowWithChildren) : null
}

/**
 * Ghi tài liệu cùng phiên bản hiện tại và các liên kết.
 *
 * Không có transaction phía client, nên thứ tự quan trọng: ghi bản ghi cha
 * TRƯỚC (bảng con có FK tới nó), rồi mới ghi con. Nếu bước con lỗi thì cha vẫn
 * tồn tại và lần lưu sau sẽ vá lại — chấp nhận được, vì mất một dòng liên kết
 * không làm mất file.
 */
export async function saveDocument(doc: Document, organizationId: string): Promise<Document> {
  const { error: docErr } = await supabase
    .from('org_documents')
    .upsert(documentToRow(doc, organizationId))
  if (docErr) throw docErr

  if (doc.versions.length > 0) {
    const { error: verErr } = await supabase.from('org_document_versions').upsert(
      doc.versions.map((v) => ({
        document_id: doc.id,
        version: v.version,
        storage_path: v.storagePath,
        size_bytes: v.sizeBytes,
        uploaded_at: v.uploadedAt,
      })),
      { onConflict: 'document_id,version' },
    )
    if (verErr) throw verErr
  }

  await replaceLinks(doc.id, doc.linkedEntities)

  const saved = await getDocument(doc.id)
  if (!saved) throw new Error('Không đọc lại được tài liệu vừa lưu')
  return saved
}

/** Thay toàn bộ liên kết của một tài liệu (xoá cái mất, thêm cái mới). */
export async function replaceLinks(
  documentId: string,
  links: LinkedEntity[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from('org_document_links')
    .delete()
    .eq('document_id', documentId)
  if (delErr) throw delErr

  if (links.length === 0) return
  const { error } = await supabase.from('org_document_links').upsert(
    links.map((l) => ({
      document_id: documentId,
      entity_type: l.type,
      entity_id: l.id,
      label: l.label,
    })),
    { onConflict: 'document_id,entity_type,entity_id' },
  )
  if (error) throw error
}

/** Cập nhật một phần — dùng cho đổi tên, gắn sao, chuyển thư mục, gắn tag. */
export async function patchDocument(
  id: string,
  patch: Partial<
    Pick<Document, 'displayName' | 'description' | 'folderId' | 'isStarred' | 'tags' | 'expiryDate'>
  >,
): Promise<void> {
  const row: Record<string, unknown> = {}
  if (patch.displayName !== undefined) row.display_name = patch.displayName
  if (patch.description !== undefined) row.description = patch.description ?? null
  if (patch.folderId !== undefined) row.folder_id = patch.folderId
  if (patch.isStarred !== undefined) row.is_starred = patch.isStarred
  if (patch.tags !== undefined) row.tags = patch.tags
  if (patch.expiryDate !== undefined) row.expiry_date = patch.expiryDate ?? null
  if (Object.keys(row).length === 0) return

  const { error } = await supabase.from('org_documents').update(row).eq('id', id)
  if (error) throw error
}

export async function softDeleteDocuments(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase
    .from('org_documents')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
  if (error) throw error
}

export async function restoreDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from('org_documents')
    .update({ deleted_at: null })
    .eq('id', id)
  if (error) throw error
}

/** Xoá hẳn bản ghi. Bảng con tự xoá theo ON DELETE CASCADE. */
export async function hardDeleteDocument(id: string): Promise<void> {
  const { error } = await supabase.from('org_documents').delete().eq('id', id)
  if (error) throw error
}
