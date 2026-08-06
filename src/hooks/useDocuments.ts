import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type {
  Document,
  DocumentFilter,
  DocumentListItem,
  MimeCategory,
  UploadFile,
  UploadSession,
  ViewMode,
} from '@/types/document'
import { DEFAULT_FILTER, STORAGE_LIMIT_BYTES } from '@/types/document'
import { usePortalOrg } from '@/hooks/usePortalOrg'
import { qk } from '@/lib/queryKeys'
import * as repo from '@/lib/documents/supabase-repo'
import {
  deleteDocumentAllVersions,
  downloadAsZip,
  downloadFile,
  getSignedUrl,
  uploadFile,
} from '@/lib/documents/supabase-storage'

function mimeCategory(file: File): MimeCategory {
  if (file.type === 'application/pdf') return 'PDF'
  if (
    file.type === 'application/msword' ||
    file.type.includes('wordprocessingml')
  )
    return 'WORD'
  if (file.type.includes('spreadsheetml') || file.type === 'application/vnd.ms-excel')
    return 'EXCEL'
  if (file.type.startsWith('image/')) return 'IMAGE'
  return 'OTHER'
}

// Nhận Document[] chứ không còn DocumentListItem[]: truy vấn mới trả về bản ghi
// ĐẦY ĐỦ (đã join versions + links), và Document là siêu tập của DocumentListItem
// nên mọi trường hàm này đọc vẫn còn nguyên.
function applyFilter(items: Document[], filter: DocumentFilter): Document[] {
  let result = items

  if (!filter.showTrashed) result = result.filter((d) => !d.deletedAt)
  else result = result.filter((d) => !!d.deletedAt)

  if (filter.showStarred) result = result.filter((d) => d.isStarred)

  if (filter.folderId !== null)
    result = result.filter((d) => d.folderId === filter.folderId)

  if (filter.tags.length > 0)
    result = result.filter((d) =>
      filter.tags.every((t) => d.tags.includes(t)),
    )

  if (filter.query.trim()) {
    const q = filter.query.toLowerCase()
    result = result.filter(
      (d) =>
        d.displayName.toLowerCase().includes(q) ||
        d.originalFilename.toLowerCase().includes(q) ||
        d.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }

  result = [...result].sort((a, b) => {
    let va: string | number = ''
    let vb: string | number = ''
    if (filter.sortField === 'name') { va = a.displayName; vb = b.displayName }
    else if (filter.sortField === 'sizeBytes') { va = a.sizeBytes; vb = b.sizeBytes }
    else if (filter.sortField === 'expiryDate') { va = a.expiryDate ?? ''; vb = b.expiryDate ?? '' }
    else { va = a.updatedAt; vb = b.updatedAt }
    const cmp = va < vb ? -1 : va > vb ? 1 : 0
    return filter.sortDir === 'asc' ? cmp : -cmp
  })

  return result
}

export function useDocuments() {
  // Đường dẫn Storage nay bắt buộc bắt đầu bằng organization_id — policy của
  // bucket gate theo segment đó (migration 20260806000030). Prefix 'default'
  // hardcode trước đây bị TỪ CHỐI.
  const { organizationId } = usePortalOrg()

  const qc = useQueryClient()
  const queryKey = qk.orgDocuments.list(organizationId)

  const { data: allDocuments = [], isLoading } = useQuery({
    queryKey,
    enabled: !!organizationId,
    queryFn: () => repo.listDocuments(organizationId!),
  })

  const [filter, setFilterState] = useState<DocumentFilter>(DEFAULT_FILTER)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [uploadSession, setUploadSession] = useState<UploadSession | null>(null)

  const reload = useCallback(() => {
    qc.invalidateQueries({ queryKey })
  }, [qc, queryKey])

  // Dung lượng đã dùng suy từ danh sách, không còn là state riêng — trước đây
  // hai nguồn này lệch nhau được (usedBytes chỉ cập nhật khi gọi reload()).
  const usedBytes = useMemo(
    () => allDocuments.filter((d) => !d.deletedAt).reduce((sum, d) => sum + d.sizeBytes, 0),
    [allDocuments],
  )

  const getAllTags = useCallback(
    () => Array.from(new Set(allDocuments.flatMap((d) => d.tags))).sort(),
    [allDocuments],
  )

  /**
   * Bọc lỗi cho mọi thao tác ghi. localStorage không bao giờ lỗi; đi mạng + RLS
   * thì có, và nuốt lỗi im lặng sẽ khiến user tưởng đã lưu.
   */
  const guard = useCallback(
    async (action: () => Promise<unknown>, failMsg: string): Promise<boolean> => {
      if (!organizationId) {
        toast.error('Chưa xác định được tổ chức. Vui lòng tải lại trang.')
        return false
      }
      try {
        await action()
        reload()
        return true
      } catch {
        toast.error(failMsg)
        return false
      }
    },
    [organizationId, reload],
  )

  const documents = useMemo(
    () => applyFilter(allDocuments, filter),
    [allDocuments, filter],
  )

  const setFilter = useCallback((patch: Partial<DocumentFilter>) => {
    setFilterState((prev) => ({ ...prev, ...patch }))
  }, [])

  // ── Selection ──────────────────────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(documents.map((d) => d.id)))
  }, [documents])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  // ── CRUD ───────────────────────────────────────────────────────────────────

  // Vẫn ĐỒNG BỘ: truy vấn đã nạp bản ghi đầy đủ nên chỉ cần tra cứu tại chỗ.
  // Nhờ vậy mọi consumer giữ nguyên, không phải đổi sang await.
  const getDocument = useCallback(
    (id: string): Document | null => allDocuments.find((d) => d.id === id) ?? null,
    [allDocuments],
  )

  const renameDocument = useCallback(
    (id: string, displayName: string) =>
      guard(() => repo.patchDocument(id, { displayName }), 'Không đổi được tên tài liệu'),
    [guard],
  )

  const moveDocument = useCallback(
    (id: string, folderId: string | null) =>
      guard(() => repo.patchDocument(id, { folderId }), 'Không chuyển được tài liệu'),
    [guard],
  )

  const starDocument = useCallback(
    (id: string, starred: boolean) =>
      guard(() => repo.patchDocument(id, { isStarred: starred }), 'Không đổi được trạng thái sao'),
    [guard],
  )

  const updateMetadata = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<Document, 'description' | 'tags' | 'linkedEntities' | 'expiryDate'>
      >,
    ) => {
      // linkedEntities nằm ở bảng riêng nên tách khỏi patch cột vô hướng.
      const { linkedEntities, ...scalar } = patch
      return guard(async () => {
        if (Object.keys(scalar).length > 0) await repo.patchDocument(id, scalar)
        if (linkedEntities) await repo.replaceLinks(id, linkedEntities)
      }, 'Không lưu được thông tin tài liệu')
    },
    [guard],
  )

  const softDeleteDocument = useCallback(
    (id: string) => guard(() => repo.softDeleteDocuments([id]), 'Không xoá được tài liệu'),
    [guard],
  )

  const restoreDocument = useCallback(
    (id: string) => guard(() => repo.restoreDocument(id), 'Không phục hồi được tài liệu'),
    [guard],
  )

  const hardDeleteDocument = useCallback(
    (id: string) =>
      guard(async () => {
        // Xoá FILE trước, bản ghi sau. Ngược lại thì nếu bước xoá file lỗi ta sẽ
        // mất luôn đường dẫn ⇒ file mồ côi vĩnh viễn trên Storage, vẫn tính tiền
        // mà không ai tìm lại được. Đây đúng là lỗi mà đợt này đang đi sửa.
        await deleteDocumentAllVersions(organizationId!, id)
        await repo.hardDeleteDocument(id)
      }, 'Không xoá vĩnh viễn được tài liệu'),
    [guard, organizationId],
  )

  // ── Upload ─────────────────────────────────────────────────────────────────

  const startUpload = useCallback(
    (files: File[], targetFolderId: string | null) => {
      // Chặn sớm thay vì để `organizationId!` dựng đường dẫn "null/..." rồi bị
      // policy của bucket từ chối với lỗi khó hiểu. organizationId còn null khi
      // usePortalOrg đang tải, hoặc khi user chưa thuộc tổ chức nào.
      if (!organizationId) {
        toast.error('Chưa xác định được tổ chức. Vui lòng tải lại trang.')
        return
      }
      const session: UploadSession = {
        id: crypto.randomUUID(),
        files: files.map((f) => ({
          localId: crypto.randomUUID(),
          file: f,
          targetFolderId,
          status: 'pending',
          progress: 0,
        })),
        startedAt: new Date().toISOString(),
      }
      setUploadSession(session)

      session.files.forEach((uf) => {
        const docId = crypto.randomUUID()
        const now = new Date().toISOString()

        setUploadSession((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            files: prev.files.map((f) =>
              f.localId === uf.localId ? { ...f, status: 'uploading' } : f,
            ),
          }
        })

        uploadFile(organizationId, docId, 1, uf.file, (pct) => {
          setUploadSession((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              files: prev.files.map((f) =>
                f.localId === uf.localId ? { ...f, progress: pct } : f,
              ),
            }
          })
        }).then(({ path, error }) => {
          if (error) {
            setUploadSession((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                files: prev.files.map((f) =>
                  f.localId === uf.localId
                    ? { ...f, status: 'error', error: error.message }
                    : f,
                ),
              }
            })
            return
          }

          const doc: Document = {
            id: docId,
            folderId: targetFolderId,
            displayName: uf.file.name,
            tags: [],
            linkedEntities: [],
            isStarred: false,
            versions: [
              {
                version: 1,
                storagePath: path,
                sizeBytes: uf.file.size,
                uploadedAt: now,
              },
            ],
            currentVersion: 1,
            mimeCategory: mimeCategory(uf.file),
            originalFilename: uf.file.name,
            sizeBytes: uf.file.size,
            storagePath: path,
            createdAt: now,
            updatedAt: now,
          }
          repo
            .saveDocument(doc, organizationId)
            .then(() => reload())
            .catch(() => toast.error(`Đã tải lên "${uf.file.name}" nhưng không lưu được thông tin`))

          setUploadSession((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              files: prev.files.map((f) =>
                f.localId === uf.localId
                  ? { ...f, status: 'done', progress: 100, documentId: docId }
                  : f,
              ),
            }
          })
        })
      })
    },
    [organizationId, reload],
  )

  const clearUploadSession = useCallback(
    () => setUploadSession(null),
    [],
  )

  // ── Download & preview ─────────────────────────────────────────────────────

  const downloadDocument = useCallback(
    async (id: string) => {
      const doc = getDocument(id)
      if (!doc) return
      await downloadFile(doc.storagePath, doc.originalFilename)
    },
    [getDocument],
  )

  const getPreviewUrl = useCallback(
    async (id: string): Promise<string | null> => {
      const doc = getDocument(id)
      if (!doc) return null
      const { url } = await getSignedUrl(doc.storagePath)
      return url
    },
    [getDocument],
  )

  // ── Bulk ──────────────────────────────────────────────────────────────────

  const bulkMove = useCallback(
    async (ids: string[], folderId: string | null) => {
      const ok = await guard(
        () => Promise.all(ids.map((id) => repo.patchDocument(id, { folderId }))),
        'Không chuyển được tài liệu',
      )
      if (ok) clearSelection()
    },
    [guard, clearSelection],
  )

  const bulkTag = useCallback(
    (ids: string[], tags: string[]) =>
      guard(
        () =>
          Promise.all(
            ids.map((id) => {
              const doc = allDocuments.find((d) => d.id === id)
              if (!doc) return Promise.resolve()
              // GỘP tag, không ghi đè — giữ đúng hành vi bản cũ.
              return repo.patchDocument(id, {
                tags: Array.from(new Set([...doc.tags, ...tags])),
              })
            }),
          ),
        'Không gắn được thẻ',
      ),
    [allDocuments, guard],
  )

  const bulkSoftDelete = useCallback(
    async (ids: string[]) => {
      // Một lượt UPDATE ... IN (...) thay vì N lượt như bản localStorage.
      const ok = await guard(() => repo.softDeleteDocuments(ids), 'Không xoá được tài liệu')
      if (ok) clearSelection()
    },
    [guard, clearSelection],
  )

  const bulkDownload = useCallback(
    async (ids: string[]) => {
      const files = ids
        .map((id) => getDocument(id))
        .filter((d): d is Document => d !== null)
        .map((doc) => ({ path: doc.storagePath, filename: doc.originalFilename }))
      await downloadAsZip(files, 'tai-lieu.zip')
    },
    [getDocument],
  )

  return {
    documents,
    allDocuments,
    isLoading,
    filter,
    viewMode,
    selectedIds,
    uploadSession,
    usedBytes,
    storageLimit: STORAGE_LIMIT_BYTES,
    setFilter,
    setViewMode,
    toggleSelect,
    selectAll,
    clearSelection,
    getDocument,
    renameDocument,
    moveDocument,
    starDocument,
    updateMetadata,
    softDeleteDocument,
    restoreDocument,
    hardDeleteDocument,
    startUpload,
    clearUploadSession,
    downloadDocument,
    getPreviewUrl,
    bulkMove,
    bulkTag,
    bulkSoftDelete,
    bulkDownload,
    getAllTags,
    reload,
  }
}

export type UseDocumentsReturn = ReturnType<typeof useDocuments>
