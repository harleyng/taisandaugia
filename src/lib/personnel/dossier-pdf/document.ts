// Lắp ráp cây nội dung pdfmake: ba mẫu (theme.ts) × tám mục bật/tắt
// (dossier-templates.ts).
//
// Tách khỏi index.ts để KHÔNG kéo theo pdfmake, font và Supabase — nhờ vậy
// kiểm thử được phần logic dễ sai nhất (mục nào in, ngắt trang ở đâu) mà không
// cần dựng file thật.

import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
import type { DossierBundle } from '../dossier-bundle'
import {
  SECTION_ORDER, normalizeSections,
  type DossierExportOptions, type DossierSectionId,
} from '../dossier-templates'
import { MARGIN, PAGE_W, themeOf } from './theme'
import { heroBlock } from './hero'
import { SECTION_BUILDERS, statsBlock } from './sections'
import type { DossierImages } from './images'

/** Gắn ngắt trang lên phần tử ĐẦU TIÊN của nhóm. Chèn một node rỗng thay thế
 *  sẽ đẻ ra một dòng trắng ngay đầu trang mới. */
function withPageBreak(c: Content): Content {
  return { ...(c as object), pageBreak: 'before' } as Content
}

export function buildDocDefinition(
  b: DossierBundle,
  orgName: string,
  img: DossierImages,
  opts: DossierExportOptions,
): TDocumentDefinitions {
  const t = themeOf(opts.template)
  const chosen = normalizeSections(opts.sections)
  const ordinals = new Map<DossierSectionId, number>()
  chosen.forEach((id, i) => ordinals.set(id, i + 1))

  const digits = b.person.licenseNumber.replace(/\D/g, '')
  const refNo = `HSĐGV-${new Date().getFullYear()}/${(digits || '0000').slice(-4).padStart(4, '0')}`
  const exported = new Date().toLocaleString('vi-VN')

  const content: Content[] = []
  t.pageGroups.forEach((group, gi) => {
    const block: Content[] = []
    if (gi === 0) {
      block.push(heroBlock(b, t, orgName, refNo, img), statsBlock(b, t))
    }
    for (const id of SECTION_ORDER) {
      if (!group.includes(id) || !chosen.includes(id)) continue
      block.push(...SECTION_BUILDERS[id](b, t, { refNo, img, ordinal: ordinals.get(id) ?? 0 }))
    }
    // Nhóm rỗng thì KHÔNG mở trang mới — bỏ hết mục của một nhóm mà vẫn ngắt
    // trang là để lại một trang trắng trong file người dùng đã trả tiền.
    if (block.length === 0) return
    if (gi > 0) block[0] = withPageBreak(block[0])
    content.push(...block)
  })

  return {
    pageSize: 'A4',
    pageMargins: [MARGIN, MARGIN, MARGIN, 46],
    background: (currentPage: number) =>
      t.hero === 'BANNER' && currentPage === 1
        ? {
            canvas: [
              { type: 'rect', x: 0, y: 0, w: PAGE_W, h: t.heroHeight, color: t.brand },
              { type: 'rect', x: 0, y: t.heroHeight, w: PAGE_W, h: 4, color: t.accent },
            ],
          }
        : '',
    defaultStyle: { font: 'Roboto', fontSize: t.bodySize, color: t.ink, lineHeight: 1.35 },
    info: { title: `Hồ sơ đấu giá viên — ${b.person.fullName}`, author: orgName || undefined },
    content,
    footer: (currentPage: number, pageCount: number) => ({
      margin: [MARGIN, 12, MARGIN, 0],
      columns: [
        { text: `${b.person.fullName.toUpperCase()} · Hồ sơ năng lực đấu giá viên · ${exported}`, fontSize: 7, color: t.muted },
        { text: `Trang ${currentPage}/${pageCount}`, fontSize: 7, color: t.muted, alignment: 'right', width: 'auto' },
      ],
    }),
  }
}
