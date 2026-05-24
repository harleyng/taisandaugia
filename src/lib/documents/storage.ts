import type { Document, DocumentListItem, Folder } from '@/types/document'
import { DEFAULT_FOLDER_NAMES } from '@/types/document'

const FOLDERS_KEY = 'tsd:folders'
const DOCUMENTS_KEY = 'tsd:documents'
const DOC_KEY = (id: string) => `tsd:documents:${id}`

// ── Folders ──────────────────────────────────────────────────────────────────

export function listFolders(): Folder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY)
    return raw ? (JSON.parse(raw) as Folder[]) : []
  } catch {
    return []
  }
}

export function saveFolders(folders: Folder[]): void {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}

export function upsertFolder(folder: Folder): void {
  const all = listFolders()
  const idx = all.findIndex((f) => f.id === folder.id)
  if (idx >= 0) all[idx] = folder
  else all.push(folder)
  saveFolders(all)
}

export function deleteFolder(id: string): void {
  saveFolders(listFolders().filter((f) => f.id !== id))
}

export function seedDefaultFolders(): void {
  if (listFolders().length > 0) return
  const now = new Date().toISOString()
  const folders: Folder[] = DEFAULT_FOLDER_NAMES.map((name, i) => ({
    id: crypto.randomUUID(),
    name,
    parentId: null,
    order: i,
    createdAt: now,
    updatedAt: now,
  }))
  saveFolders(folders)
}

// ── Document index ────────────────────────────────────────────────────────────

export function listDocuments(): DocumentListItem[] {
  try {
    const raw = localStorage.getItem(DOCUMENTS_KEY)
    return raw ? (JSON.parse(raw) as DocumentListItem[]) : []
  } catch {
    return []
  }
}

function saveDocumentIndex(items: DocumentListItem[]): void {
  localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(items))
}

function toListItem(doc: Document): DocumentListItem {
  return {
    id: doc.id,
    folderId: doc.folderId,
    displayName: doc.displayName,
    tags: doc.tags,
    isStarred: doc.isStarred,
    mimeCategory: doc.mimeCategory,
    originalFilename: doc.originalFilename,
    sizeBytes: doc.sizeBytes,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt,
    expiryDate: doc.expiryDate,
    linkedEntities: doc.linkedEntities,
  }
}

// ── Document full payload ─────────────────────────────────────────────────────

export function getDocument(id: string): Document | null {
  try {
    const raw = localStorage.getItem(DOC_KEY(id))
    return raw ? (JSON.parse(raw) as Document) : null
  } catch {
    return null
  }
}

export function saveDocument(doc: Document): void {
  localStorage.setItem(DOC_KEY(doc.id), JSON.stringify(doc))
  const index = listDocuments()
  const idx = index.findIndex((d) => d.id === doc.id)
  const item = toListItem(doc)
  if (idx >= 0) index[idx] = item
  else index.push(item)
  saveDocumentIndex(index)
}

export function softDeleteDocument(id: string): void {
  const doc = getDocument(id)
  if (!doc) return
  const now = new Date().toISOString()
  doc.deletedAt = now
  doc.updatedAt = now
  saveDocument(doc)
}

export function restoreDocument(id: string): void {
  const doc = getDocument(id)
  if (!doc) return
  delete doc.deletedAt
  doc.updatedAt = new Date().toISOString()
  saveDocument(doc)
}

export function hardDeleteDocument(id: string): void {
  localStorage.removeItem(DOC_KEY(id))
  saveDocumentIndex(listDocuments().filter((d) => d.id !== id))
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function getAllTags(): string[] {
  const tags = new Set<string>()
  listDocuments().forEach((d) => d.tags.forEach((t) => tags.add(t)))
  return Array.from(tags).sort()
}

export function getUsedBytes(): number {
  return listDocuments()
    .filter((d) => !d.deletedAt)
    .reduce((sum, d) => sum + d.sizeBytes, 0)
}
