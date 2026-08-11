// Lắp ráp bản xuất PDF hồ sơ đấu giá viên.
//
// Ba mẫu (theme.ts) × tám mục bật/tắt (dossier-templates.ts). Mục nào không
// được chọn thì KHÔNG dựng — và ngắt trang cũng đi theo, nên bỏ một mục không
// để lại trang trắng.
//
// Chữ: Lora cho tên và số liệu lớn (nạp từ assets), Roboto cho phần còn lại —
// cả hai đều phủ đủ dấu tiếng Việt. Thiết kế gốc dùng Be Vietnam Pro cho thân
// chữ; Roboto thay vào để khỏi gánh thêm một font nữa vào bundle.

import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import type { DossierBundle } from '../dossier-bundle'
import {
  DEFAULT_EXPORT_OPTIONS, type DossierExportOptions,
} from '../dossier-templates'
import { loadLoraFonts } from '../pdf-assets'
import { buildDocDefinition } from './document'
import { loadDossierImages, type DossierImages } from './images'

export type { DossierImages }
export { loadDossierImages }

type FontMap = Record<string, string>

function looksLikeFontMap(v: unknown): v is FontMap {
  if (!v || typeof v !== 'object') return false
  return Object.entries(v as Record<string, unknown>).some(
    ([k, val]) => k.toLowerCase().endsWith('.ttf') && typeof val === 'string' && val.length > 0,
  )
}

/**
 * Tìm bản đồ font trong module vfs_fonts.
 *
 * Hình dạng export KHÁC NHAU tuỳ bundler — đã đo thực tế: chạy trong Node thì
 * nằm ở `.vfs`, còn khi Vite/esbuild bundle cho trình duyệt thì `default` CHÍNH
 * LÀ bản đồ font và không hề có `.vfs`. Dò theo HÌNH DẠNG thay vì đoán tên
 * thuộc tính, để đổi bundler hay nâng pdfmake không vỡ lại.
 */
function resolveVfs(mod: unknown): FontMap | null {
  const m = mod as Record<string, unknown>
  const d = m?.default as Record<string, unknown> | undefined
  const candidates: unknown[] = [
    m?.vfs, d?.vfs,
    (d?.pdfMake as Record<string, unknown> | undefined)?.vfs,
    (m?.pdfMake as Record<string, unknown> | undefined)?.vfs,
    d, m,
  ]
  for (const c of candidates) if (looksLikeFontMap(c)) return c
  return null
}

type PdfMakeInstance = {
  addVirtualFileSystem: (vfs: Record<string, string>) => void
  fonts: Record<string, { normal: string; bold: string; italics: string; bolditalics: string }>
  createPdf: (dd: TDocumentDefinitions) => { getBlob: () => Promise<Blob> }
}

export async function dossierPdfBlob(
  b: DossierBundle,
  orgName: string,
  opts: DossierExportOptions = DEFAULT_EXPORT_OPTIONS,
): Promise<Blob> {
  const [pdfMakeModule, vfsModule, lora, images] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
    loadLoraFonts(),
    loadDossierImages(b),
  ])

  const pdfMake = ((pdfMakeModule as unknown as { default?: PdfMakeInstance }).default ??
    pdfMakeModule) as unknown as PdfMakeInstance

  const vfs = resolveVfs(vfsModule)

  // pdfmake 0.3 đọc font từ `virtualfs` và CHỈ nạp qua addVirtualFileSystem().
  // Gán `pdfMake.vfs = …` (API của 0.2) là no-op im lặng — font không vào được
  // và lỗi chỉ nổ ở tận lúc dựng trang: "Roboto-Medium.ttf not found".
  if (!vfs || typeof pdfMake.addVirtualFileSystem !== 'function') {
    throw new Error('Không nạp được font PDF (pdfmake virtual file system).')
  }
  pdfMake.addVirtualFileSystem({ ...vfs, ...lora })

  // Lora chỉ có Regular/SemiBold — trỏ italics về cùng file, thiết kế không dùng nghiêng.
  pdfMake.fonts = {
    ...pdfMake.fonts,
    Lora: {
      normal: 'Lora-Regular.ttf',
      bold: 'Lora-SemiBold.ttf',
      italics: 'Lora-Regular.ttf',
      bolditalics: 'Lora-SemiBold.ttf',
    },
  }

  // getBlob() của 0.3 là async và KHÔNG nhận callback. Bản trước truyền callback
  // rồi bọc trong new Promise ⇒ promise không bao giờ settle và nút kẹt
  // "Đang tạo…" vĩnh viễn.
  return pdfMake.createPdf(buildDocDefinition(b, orgName, images, opts)).getBlob()
}
