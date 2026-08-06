import { describe, it, expect } from 'vitest'
import {
  documentToRow,
  folderToRow,
  mimeCategoryOf,
  rowToDocument,
  rowToFolder,
  type DocumentRow,
  type DocumentRowWithChildren,
  type FolderRow,
} from './mappers'
import type { Document, Folder } from '@/types/document'

const ORG = '11111111-1111-1111-1111-111111111111'
const DOC = '22222222-2222-2222-2222-222222222222'

const folderRow = (over: Partial<FolderRow> = {}): FolderRow => ({
  id: 'f1',
  organization_id: ORG,
  name: 'Pháp lý công ty',
  parent_id: null,
  sort_order: 3,
  color: null,
  created_at: '2026-08-06T00:00:00Z',
  updated_at: '2026-08-06T00:00:00Z',
  deleted_at: null,
  ...over,
})

const docRow = (over: Partial<DocumentRowWithChildren> = {}): DocumentRowWithChildren => ({
  id: DOC,
  organization_id: ORG,
  folder_id: 'f1',
  display_name: 'Giấy phép đăng ký',
  description: null,
  tags: ['pháp lý'],
  expiry_date: null,
  is_starred: false,
  mime_category: 'PDF',
  original_filename: 'gp.pdf',
  size_bytes: 12345,
  storage_path: `${ORG}/${DOC}/v1/gp.pdf`,
  current_version: 1,
  created_at: '2026-08-06T00:00:00Z',
  updated_at: '2026-08-06T00:00:00Z',
  deleted_at: null,
  ...(over as Partial<DocumentRow>),
})

describe('rowToFolder', () => {
  it('đổi sort_order (DB) thành order (UI)', () => {
    // `order` là từ khoá SQL nên DB phải dùng tên khác — đây đúng là chỗ dễ lệch.
    expect(rowToFolder(folderRow()).order).toBe(3)
  })

  it('cột NULL thành undefined, không phải null', () => {
    const f = rowToFolder(folderRow())
    expect(f.color).toBeUndefined()
    expect(f.deletedAt).toBeUndefined()
  })

  it('giữ deletedAt khi thư mục nằm trong thùng rác', () => {
    const f = rowToFolder(folderRow({ deleted_at: '2026-08-06T10:00:00Z' }))
    expect(f.deletedAt).toBe('2026-08-06T10:00:00Z')
  })
})

describe('folderToRow', () => {
  it('vòng tròn folder → row → folder giữ nguyên dữ liệu', () => {
    const original = rowToFolder(folderRow({ color: '#fff', sort_order: 7 }))
    const back = rowToFolder({
      ...folderRow(),
      ...folderToRow(original, ORG),
    } as FolderRow)
    expect(back).toEqual(original)
  })

  it('undefined ở UI thành null khi ghi DB', () => {
    const f: Folder = {
      id: 'f2',
      name: 'Khác',
      parentId: null,
      order: 0,
      createdAt: 'x',
      updatedAt: 'x',
    }
    const row = folderToRow(f, ORG)
    expect(row.color).toBeNull()
    expect(row.deleted_at).toBeNull()
  })
})

describe('rowToDocument', () => {
  it('sắp phiên bản TĂNG dần theo số, bất kể thứ tự DB trả về', () => {
    // Không có ORDER BY thì Postgres không bảo đảm thứ tự; VersionHistoryPanel
    // lại dựa vào nó.
    const d = rowToDocument(
      docRow({
        org_document_versions: [
          { id: 'v3', document_id: DOC, version: 3, storage_path: 'p3', size_bytes: 3, uploaded_at: 'c', uploaded_by: null },
          { id: 'v1', document_id: DOC, version: 1, storage_path: 'p1', size_bytes: 1, uploaded_at: 'a', uploaded_by: null },
          { id: 'v2', document_id: DOC, version: 2, storage_path: 'p2', size_bytes: 2, uploaded_at: 'b', uploaded_by: null },
        ],
      }),
    )
    expect(d.versions.map((v) => v.version)).toEqual([1, 2, 3])
  })

  it('bảng con thiếu (truy vấn không join) thành mảng rỗng, không phải undefined', () => {
    // UI gọi doc.versions.length / doc.linkedEntities.map ngay, undefined là crash.
    const d = rowToDocument(docRow({ org_document_versions: null, org_document_links: null }))
    expect(d.versions).toEqual([])
    expect(d.linkedEntities).toEqual([])
  })

  it('tags NULL thành mảng rỗng', () => {
    const d = rowToDocument(docRow({ tags: null as unknown as string[] }))
    expect(d.tags).toEqual([])
  })

  it('ánh xạ liên kết sang thực thể UI', () => {
    const d = rowToDocument(
      docRow({
        org_document_links: [
          { id: 'l1', document_id: DOC, entity_type: 'TAX_YEAR', entity_id: '2025', label: 'Thuế 2025', created_at: 'x' },
        ],
      }),
    )
    expect(d.linkedEntities).toEqual([{ type: 'TAX_YEAR', id: '2025', label: 'Thuế 2025' }])
  })

  it('size_bytes (BIGINT) luôn là number', () => {
    const d = rowToDocument(docRow({ size_bytes: '98765' as unknown as number }))
    expect(d.sizeBytes).toBe(98765)
    expect(typeof d.sizeBytes).toBe('number')
  })
})

describe('documentToRow', () => {
  it('vòng tròn document → row → document giữ nguyên trường vô hướng', () => {
    const original = rowToDocument(docRow({ description: 'ghi chú', expiry_date: '2027-01-01' }))
    const back = rowToDocument({ ...docRow(), ...documentToRow(original, ORG) } as DocumentRowWithChildren)
    // Bỏ qua mảng con: chúng nằm ở bảng riêng, documentToRow không mang theo.
    const strip = (d: Document): Document => ({ ...d, versions: [], linkedEntities: [] })
    expect(strip(back)).toEqual(strip(original))
  })
})

describe('mimeCategoryOf', () => {
  it('phân loại theo phần mở rộng', () => {
    expect(mimeCategoryOf('a.pdf')).toBe('PDF')
    expect(mimeCategoryOf('a.DOCX')).toBe('WORD')
    expect(mimeCategoryOf('bảng.xlsx')).toBe('EXCEL')
    expect(mimeCategoryOf('ảnh.PNG')).toBe('IMAGE')
    expect(mimeCategoryOf('x.zip')).toBe('OTHER')
    expect(mimeCategoryOf('không-có-ext')).toBe('OTHER')
  })
})
