import { useCallback, useMemo, useState } from 'react'
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
import {
  getAllTags,
  getDocument as lsGetDocument,
  getUsedBytes,
  hardDeleteDocument as lsHardDelete,
  listDocuments,
  restoreDocument as lsRestore,
  saveDocument,
  softDeleteDocument as lsSoftDelete,
} from '@/lib/documents/storage'
import {
  deleteDocumentAllVersions,
  downloadAsZip,
  downloadFile,
  getSignedUrl,
  uploadFile,
} from '@/lib/documents/supabase-storage'
import { buildStoragePath } from '@/lib/documents/supabase-storage'

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

function applyFilter(
  items: DocumentListItem[],
  filter: DocumentFilter,
): DocumentListItem[] {
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
  const [allDocuments, setAllDocuments] = useState<DocumentListItem[]>(() =>
    listDocuments(),
  )
  const [filter, setFilterState] = useState<DocumentFilter>(DEFAULT_FILTER)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [uploadSession, setUploadSession] = useState<UploadSession | null>(null)
  const [usedBytes, setUsedBytes] = useState(() => getUsedBytes())

  const reload = useCallback(() => {
    setAllDocuments(listDocuments())
    setUsedBytes(getUsedBytes())
  }, [])

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

  const getDocument = useCallback(
    (id: string): Document | null => lsGetDocument(id),
    [],
  )

  const renameDocument = useCallback(
    (id: string, displayName: string) => {
      const doc = lsGetDocument(id)
      if (!doc) return
      saveDocument({ ...doc, displayName, updatedAt: new Date().toISOString() })
      reload()
    },
    [reload],
  )

  const moveDocument = useCallback(
    (id: string, folderId: string | null) => {
      const doc = lsGetDocument(id)
      if (!doc) return
      saveDocument({ ...doc, folderId, updatedAt: new Date().toISOString() })
      reload()
    },
    [reload],
  )

  const starDocument = useCallback(
    (id: string, starred: boolean) => {
      const doc = lsGetDocument(id)
      if (!doc) return
      saveDocument({ ...doc, isStarred: starred, updatedAt: new Date().toISOString() })
      reload()
    },
    [reload],
  )

  const updateMetadata = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<Document, 'description' | 'tags' | 'linkedEntities' | 'expiryDate'>
      >,
    ) => {
      const doc = lsGetDocument(id)
      if (!doc) return
      saveDocument({ ...doc, ...patch, updatedAt: new Date().toISOString() })
      reload()
    },
    [reload],
  )

  const softDeleteDocument = useCallback(
    (id: string) => {
      lsSoftDelete(id)
      reload()
    },
    [reload],
  )

  const restoreDocument = useCallback(
    (id: string) => {
      lsRestore(id)
      reload()
    },
    [reload],
  )

  const hardDeleteDocument = useCallback(
    async (id: string) => {
      await deleteDocumentAllVersions(id)
      lsHardDelete(id)
      reload()
    },
    [reload],
  )

  // ── Upload ─────────────────────────────────────────────────────────────────

  const startUpload = useCallback(
    (files: File[], targetFolderId: string | null) => {
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

        uploadFile(docId, 1, uf.file, (pct) => {
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
          saveDocument(doc)
          reload()

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
    [reload],
  )

  const clearUploadSession = useCallback(
    () => setUploadSession(null),
    [],
  )

  // ── Download & preview ─────────────────────────────────────────────────────

  const downloadDocument = useCallback(async (id: string) => {
    const doc = lsGetDocument(id)
    if (!doc) return
    await downloadFile(doc.storagePath, doc.originalFilename)
  }, [])

  const getPreviewUrl = useCallback(
    async (id: string): Promise<string | null> => {
      const doc = lsGetDocument(id)
      if (!doc) return null
      const { url } = await getSignedUrl(doc.storagePath)
      return url
    },
    [],
  )

  // ── Bulk ──────────────────────────────────────────────────────────────────

  const bulkMove = useCallback(
    (ids: string[], folderId: string | null) => {
      ids.forEach((id) => {
        const doc = lsGetDocument(id)
        if (doc)
          saveDocument({ ...doc, folderId, updatedAt: new Date().toISOString() })
      })
      reload()
      clearSelection()
    },
    [reload, clearSelection],
  )

  const bulkTag = useCallback(
    (ids: string[], tags: string[]) => {
      ids.forEach((id) => {
        const doc = lsGetDocument(id)
        if (doc) {
          const merged = Array.from(new Set([...doc.tags, ...tags]))
          saveDocument({ ...doc, tags: merged, updatedAt: new Date().toISOString() })
        }
      })
      reload()
    },
    [reload],
  )

  const bulkSoftDelete = useCallback(
    (ids: string[]) => {
      ids.forEach((id) => lsSoftDelete(id))
      reload()
      clearSelection()
    },
    [reload, clearSelection],
  )

  const bulkDownload = useCallback(
    async (ids: string[]) => {
      const files = ids
        .map((id) => lsGetDocument(id))
        .filter(Boolean)
        .map((doc) => ({ path: doc!.storagePath, filename: doc!.originalFilename }))
      await downloadAsZip(files, 'tai-lieu.zip')
    },
    [],
  )

  return {
    documents,
    allDocuments,
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
