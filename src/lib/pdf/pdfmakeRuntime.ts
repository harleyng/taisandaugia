// Runtime pdfmake dùng chung cho mọi bản xuất PDF (hồ sơ đấu giá viên, dự thảo
// hợp đồng ký gửi…).
//
// Nạp ĐỘNG: pdfmake + font nặng ~2MB, chỉ tải khi người dùng thực sự bấm xuất.
// Hai cái bẫy đã từng cắn — đừng "đơn giản hoá" lại:
//   • Hình dạng export của vfs_fonts khác nhau giữa Node và Vite (xem resolveVfs).
//   • pdfmake 0.3 CHỈ nhận font qua addVirtualFileSystem(); gán `pdfMake.vfs`
//     (API 0.2) là no-op im lặng, lỗi nổ tận lúc dựng trang.

import type { TDocumentDefinitions } from 'pdfmake/interfaces'
import { loadLoraFonts } from '@/lib/personnel/pdf-assets'

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

export type PdfMakeInstance = {
  addVirtualFileSystem: (vfs: Record<string, string>) => void
  fonts: Record<string, { normal: string; bold: string; italics: string; bolditalics: string }>
  /** getBlob() của 0.3 là async và KHÔNG nhận callback — bọc callback trong Promise là treo vĩnh viễn. */
  createPdf: (dd: TDocumentDefinitions) => { getBlob: () => Promise<Blob> }
}

export interface LoadPdfMakeOptions {
  /** Nạp thêm Lora (tên, số liệu lớn). Mặc định chỉ Roboto có sẵn trong vfs_fonts. */
  lora?: boolean
}

export async function loadPdfMake(opts: LoadPdfMakeOptions = {}): Promise<PdfMakeInstance> {
  const [pdfMakeModule, vfsModule, lora] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
    opts.lora ? loadLoraFonts() : Promise.resolve({} as FontMap),
  ])

  const pdfMake = ((pdfMakeModule as unknown as { default?: PdfMakeInstance }).default ??
    pdfMakeModule) as unknown as PdfMakeInstance

  const vfs = resolveVfs(vfsModule)
  if (!vfs || typeof pdfMake.addVirtualFileSystem !== 'function') {
    throw new Error('Không nạp được font PDF (pdfmake virtual file system).')
  }
  pdfMake.addVirtualFileSystem({ ...vfs, ...lora })

  if (opts.lora) {
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
  }

  return pdfMake
}
