export type LinkedEntityType = 'AUCTIONEER' | 'AUCTION' | 'TAX_YEAR' | 'INFRASTRUCTURE_SECTION'

export type MimeCategory = 'PDF' | 'WORD' | 'EXCEL' | 'IMAGE' | 'OTHER'

export type ViewMode = 'list' | 'grid'

export type SortField = 'name' | 'updatedAt' | 'sizeBytes' | 'expiryDate'

export const STORAGE_LIMIT_BYTES = 500 * 1024 * 1024 // 500MB Starter

export const DEFAULT_FOLDER_NAMES = [
  'Pháp lý công ty',
  'Nhân sự',
  'Cơ sở vật chất',
  'Thuế & Tài chính',
  'Hợp đồng đấu giá',
  'Biên bản & Kết quả',
  'Khác',
] as const

export interface Folder {
  id: string
  name: string
  parentId: string | null
  order: number
  color?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface LinkedEntity {
  type: LinkedEntityType
  id: string
  label: string
}

export interface DocumentVersion {
  version: number
  storagePath: string
  sizeBytes: number
  uploadedAt: string
}

export interface Document {
  id: string
  folderId: string | null
  displayName: string
  description?: string
  tags: string[]
  linkedEntities: LinkedEntity[]
  expiryDate?: string
  isStarred: boolean
  versions: DocumentVersion[]
  currentVersion: number
  mimeCategory: MimeCategory
  originalFilename: string
  sizeBytes: number
  storagePath: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export type DocumentListItem = Pick<
  Document,
  | 'id'
  | 'folderId'
  | 'displayName'
  | 'tags'
  | 'isStarred'
  | 'mimeCategory'
  | 'originalFilename'
  | 'sizeBytes'
  | 'updatedAt'
  | 'deletedAt'
  | 'expiryDate'
  | 'linkedEntities'
>

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error'

export interface UploadFile {
  localId: string
  file: File
  targetFolderId: string | null
  status: UploadStatus
  progress: number
  error?: string
  documentId?: string
}

export interface UploadSession {
  id: string
  files: UploadFile[]
  startedAt: string
}

export interface DocumentFilter {
  query: string
  folderId: string | null
  tags: string[]
  showTrashed: boolean
  showStarred: boolean
  sortField: SortField
  sortDir: 'asc' | 'desc'
}

export const DEFAULT_FILTER: DocumentFilter = {
  query: '',
  folderId: null,
  tags: [],
  showTrashed: false,
  showStarred: false,
  sortField: 'updatedAt',
  sortDir: 'desc',
}
