// Mỗi mục nội dung là một hàm dựng độc lập, để bật/tắt được mà không kéo theo
// mục khác. Thứ tự in do tầng lắp ráp quyết định theo SECTION_ORDER.

import type { Content, TableCell } from 'pdfmake/interfaces'
import type { DossierBundle } from '../dossier-bundle'
import type { DossierSectionId } from '../dossier-templates'
import { auctionStats, notableAuctions, categoryLabel } from '../auction-source'
import { POSITION_LABELS, computePracticeYears } from '@/types/auctioneer'
import { DOC_TYPE_LABELS, GENDER_LABELS, ID_TYPE_LABELS } from '@/types/personnel'
import type { DossierEvent } from '@/types/personnel'
import { EMPTY_CPD_CATALOG } from '@/types/cpd-catalog'
import { creditedHoursOf, formLabel, indexCatalog, makeCpdResolver } from '../cpd-catalog'
import { trainingCompliance } from '../completeness'
import { progressHours } from '../cpd'
import { CS, MARGIN, PAGE_W, type DossierTheme } from './theme'
import {
  billions, cardGrid, dataTable, fmtDate, infoGrid, money, pct, section, sectionHeading, timeline,
} from './primitives'
import type { DossierImages } from './images'

export interface SectionCtx {
  refNo: string
  img: DossierImages
  /** Số thứ tự mục — mẫu Hành chính in thành số La Mã. */
  ordinal: number
}

const emptyNote = (t: DossierTheme, text: string): Content =>
  ({ text, fontSize: 9, italics: true, color: t.muted })

/** Dải 4 chỉ số — thuộc phong cách của mẫu, không phải mục bật/tắt. */
export function statsBlock(b: DossierBundle, t: DossierTheme): Content {
  const s = auctionStats(b.auctions)
  const successRate = s.total > 0 ? Math.round((s.successful / s.total) * 100) : 0
  const cells: Array<[string, string]> = [
    [String(s.total), 'Cuộc đã điều hành'],
    [String(s.successful), `Cuộc đấu giá thành (${successRate}%)`],
    [s.avgDiffPercent === null ? '—' : pct(s.avgDiffPercent, true),
      'Chênh lệch bình quân so giá khởi điểm'],
    [billions(s.totalWinningValue), 'Tổng giá trị trúng (tỷ đồng)'],
  ]

  if (t.stats === 'INLINE') {
    // Mẫu tối giản: dồn thành một dòng chữ, kẻ chân mảnh — không chiếm 1/6 trang.
    return {
      margin: [0, 12, 0, 4],
      table: {
        widths: ['*'],
        body: [[{
          text: cells.map(([n, l]) => `${n} ${l.toLowerCase()}`).join('  ·  '),
          fontSize: 8.5, color: t.ink, border: [false, false, false, true],
          margin: [0, 0, 0, 8],
        }]],
      },
      layout: {
        hLineColor: () => t.line,
        hLineWidth: (i: number) => (i === 1 ? 0.7 : 0),
        vLineWidth: () => 0,
        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
      },
    }
  }

  return {
    // Dải chỉ số bám sát mép hero, kẻ dọc ngăn giữa các ô.
    table: {
      widths: ['*', '*', '*', '*'],
      // KHÔNG đặt `border` ở cấp ô: nó đè lên layout và xoá sạch border-right
      // giữa các chỉ số cùng border-bottom của cả dải (.stats trong HTML).
      body: [cells.map(([n, l]) => ({
        margin: [12, 14, 12, 14],
        stack: [
          { text: n, font: t.display, fontSize: 19, bold: true, color: t.brand },
          { text: l.toUpperCase(), fontSize: 6.8, color: t.muted, characterSpacing: CS.statLabel, margin: [0, 3, 0, 0], lineHeight: 1.25 },
        ],
      }))],
    },
    layout: {
      hLineColor: () => t.line, vLineColor: () => t.line,
      hLineWidth: (i: number) => (i === 1 ? 0.7 : 0),
      vLineWidth: (i: number) => (i === 0 || i === 4 ? 0 : 0.7),
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
    margin: t.statsBleed ? [-MARGIN, 22, -MARGIN, 12] : [0, 16, 0, 6],
  }
}

function strengths(b: DossierBundle, t: DossierTheme, ctx: SectionCtx): Content[] {
  const stats = auctionStats(b.auctions)
  return [section(t, 'Sở trường tài sản', ctx.ordinal, cardGrid(
    t,
    stats.topCategories.slice(0, 4).map((c) => ({ title: c.label, meta: `${c.count} cuộc đã điều hành` })),
    2,
  ))]
}

function education(b: DossierBundle, t: DossierTheme, ctx: SectionCtx): Content[] {
  const { person } = b
  return [section(t, 'Đào tạo', ctx.ordinal, cardGrid(t, [
    { title: person.educationLevel ?? '—', meta: 'Trình độ học vấn' },
    { title: person.major ?? '—', meta: 'Chuyên ngành' },
    { title: person.almaMater ?? '—', meta: 'Cơ sở đào tạo' },
  ], 3, t.brand))]
}

function notable(b: DossierBundle, t: DossierTheme, ctx: SectionCtx): Content[] {
  const rows = notableAuctions(b.auctions, 4)
  const out: Content[] = [sectionHeading(t, 'Cuộc đấu giá tiêu biểu', ctx.ordinal)]

  if (rows.length === 0) {
    out.push(emptyNote(t, 'Chưa ghi nhận cuộc đấu giá nào có chênh lệch so với giá khởi điểm.'))
    return out
  }

  out.push(dataTable(
    t,
    [
      { text: 'Ngày', width: 52 },
      { text: 'Tài sản' },
      { text: 'Giá khởi điểm', align: 'right', width: 78 },
      { text: 'Giá trúng', align: 'right', width: 78 },
      { text: 'Chênh lệch', align: 'right', width: 78 },
    ],
    rows.map((a): TableCell[] => [
      { text: fmtDate(a.date), fontSize: 8.5 },
      {
        stack: [
          { text: a.assetDescription, fontSize: 8.5 },
          { text: categoryLabel(a.assetCategory), fontSize: 7.5, color: t.muted, margin: [0, 2, 0, 0] },
        ],
      },
      { text: money(a.startingPrice), fontSize: 8.5, alignment: 'right' },
      { text: money(a.winningPrice), fontSize: 8.5, alignment: 'right' },
      {
        stack: [
          { text: pct(a.priceDiffPercent ?? 0, true), fontSize: 8.5, bold: true, color: t.ok, alignment: 'right' },
          { text: money(a.priceDiff), fontSize: 7.5, color: t.muted, alignment: 'right' },
        ],
      },
    ]),
  ))
  return out
}

function cpd(b: DossierBundle, t: DossierTheme, ctx: SectionCtx): Content[] {
  const { events, cpdExemptions = [], cpdCatalog = EMPTY_CPD_CATALOG } = b
  const cpdIndex = indexCatalog(cpdCatalog)
  const resolveCpd = makeCpdResolver(cpdCatalog)
  const cpdLabel = (e: DossierEvent) => formLabel(
    e.cpdActivityTypeId ? cpdIndex.typeById.get(e.cpdActivityTypeId) : undefined,
    e.cpdActivityRoleId ? cpdIndex.roleById.get(e.cpdActivityRoleId) : undefined,
  )
  const training = events.filter((e) => e.eventType === 'TRAINING')
  const cpdYear = new Date().getFullYear()
  const cpdExemption = cpdExemptions.find((x) => x.year === cpdYear)
  const cpdExemptName = cpdExemption
    ? cpdIndex.reasonById.get(cpdExemption.reasonId)?.name
    : undefined
  const comp = trainingCompliance(
    events,
    cpdYear,
    resolveCpd,
    cpdExemption ? { reasonName: cpdExemptName } : undefined,
    cpdLabel,
  )

  const out: Content[] = [sectionHeading(t, 'Bồi dưỡng nghiệp vụ', ctx.ordinal)]

  out.push(training.length === 0
    ? emptyNote(t, 'Chưa ghi nhận khoá bồi dưỡng nào.')
    : dataTable(
        t,
        [
          { text: 'Ngày', width: 52 },
          { text: 'Hình thức', width: 92 },
          { text: 'Nội dung' },
          { text: 'Đơn vị tổ chức', width: 110 },
          { text: 'Giờ', align: 'right', width: 28 },
        ],
        training.map((e) => [
          { text: fmtDate(e.startedOn), fontSize: 8.5 },
          { text: cpdLabel(e) || '—', fontSize: 8.5 },
          { text: e.title, fontSize: 8.5 },
          { text: e.organizationName ?? '—', fontSize: 8.5 },
          {
            // Giờ ĐƯỢC TÍNH; hoạt động cho đạt cả năm in gạch ngang.
            text: (() => {
              const r = resolveCpd(e)
              return r?.mode === 'HOURS' ? String(creditedHoursOf(e, r)) : '—'
            })(),
            fontSize: 8.5, alignment: 'right',
          },
        ]),
      ))

  // Chip tuân thủ: xanh khi đủ giờ, hổ phách khi thiếu. Mẫu hành chính dùng
  // dạng kẻ viền để in đen trắng không mất chữ trong khối nền.
  const filled = t.chip === 'FILLED'
  out.push({
    margin: [0, 10, 0, 0],
    table: {
      widths: ['auto'],
      body: [[{
        text: `${filled ? '●  ' : ''}Tuân thủ bồi dưỡng bắt buộc (năm ${comp.year}): ${
          comp.isExempt
            ? `được miễn — ${cpdExemptName ?? 'không rõ lý do'}`
            : `${progressHours(comp)}/${comp.required} giờ — ${
                comp.ok ? 'Đạt' : `còn thiếu ${comp.required - comp.hours} giờ`
              }`
        }`,
        fontSize: 8.5, bold: true,
        color: comp.ok ? t.ok : t.warn,
        ...(filled
          ? { fillColor: comp.ok ? t.okSoft : t.warnSoft, border: [false, false, false, false] as [boolean, boolean, boolean, boolean] }
          : {}),
        margin: [10, 6, 10, 6],
      }]],
    },
    layout: {
      defaultBorder: !filled,
      hLineColor: () => t.line, vLineColor: () => t.line,
      hLineWidth: () => (filled ? 0 : 0.6), vLineWidth: () => (filled ? 0 : 0.6),
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
  })

  return out
}

function rewards(b: DossierBundle, t: DossierTheme, ctx: SectionCtx): Content[] {
  // Hồ sơ năng lực CHỈ in khen thưởng. Kỷ luật vẫn khai báo và tra cứu được
  // trong portal, nhưng không đưa vào bản xuất — đây là hồ sơ để nộp thầu,
  // không phải bản kiểm điểm.
  const rows = b.events.filter((e) => e.eventType === 'REWARD')
  // Dùng section() (unbreakable) chứ không phải tiêu đề rời như các bảng dài:
  // danh sách khen thưởng thường vài dòng, để rời thì mẫu chảy tự do bỏ lại
  // mỗi chữ "KHEN THƯỞNG" ở đáy trang còn nội dung sang trang sau.
  return [
    section(t, 'Khen thưởng', ctx.ordinal, rows.length === 0
      ? emptyNote(t, 'Không có.')
      : timeline(t, rows.map((e) => ({
          date: fmtDate(e.startedOn),
          title: e.title,
          meta: [e.organizationName, e.referenceNo].filter(Boolean).join(' · '),
          flag: 'Khen thưởng',
        })))),
  ]
}

function identity(b: DossierBundle, t: DossierTheme, ctx: SectionCtx): Content[] {
  const { person } = b
  return [section(t, 'Thông tin định danh', ctx.ordinal, infoGrid(t, [
    ['Ngày sinh', fmtDate(person.dateOfBirth)],
    ['Giới tính', person.gender ? GENDER_LABELS[person.gender] : '—'],
    ['Quê quán', person.hometown ?? '—'],
    ['Dân tộc', person.ethnicity ?? '—'],
    ['Quốc tịch', person.nationality ?? '—'],
    ['Địa chỉ thường trú', person.permanentAddress ?? '—'],
    [person.idType ? ID_TYPE_LABELS[person.idType] : 'Số giấy tờ', person.idNumber ?? '—'],
    ['Ngày cấp', fmtDate(person.idIssuedDate)],
    ['Nơi cấp', person.idIssuedPlace ?? '—'],
    ['Email', person.email ?? '—'],
    ['Điện thoại', person.phone ?? '—'],
  ]))]
}

function practice(b: DossierBundle, t: DossierTheme, ctx: SectionCtx): Content[] {
  const { person } = b
  return [section(t, 'Thông tin hành nghề', ctx.ordinal, infoGrid(t, [
    ['Số thẻ đấu giá viên', person.licenseNumber],
    ['Ngày cấp thẻ', fmtDate(person.licenseIssuedDate)],
    ['Hiệu lực thẻ', person.licenseExpiryDate ? fmtDate(person.licenseExpiryDate) : 'Không thời hạn'],
    ['Số chứng chỉ hành nghề', person.professionalCertNumber || '—'],
    ['Ngày cấp CCHN', fmtDate(person.professionalCertIssuedDate)],
    ['Ngày bắt đầu hành nghề', fmtDate(person.practiceStartDate ?? person.licenseIssuedDate)],
    ['Số năm hành nghề', `${computePracticeYears(person)} năm`],
    ['Chức vụ', POSITION_LABELS[person.position]],
    ['Ngày giữ chức quản lý', fmtDate(person.managementStartDate)],
    ['Loại hợp đồng', person.contractType === 'OFFICIAL' ? 'Chính thức' : 'Cộng tác viên'],
    ['Công tác tại tổ chức từ', fmtDate(person.joinedDate)],
  ]))]
}

function docExpiryLabel(t: DossierTheme, expiry?: string): { text: string; color: string } {
  if (!expiry) return { text: 'Còn hiệu lực', color: t.ok }
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return { text: 'Đã hết hạn', color: t.danger }
  if (days < 60) return { text: `Sắp hết hạn (còn ${days} ngày)`, color: t.warn }
  return { text: 'Còn hiệu lực', color: t.ok }
}

function annex(b: DossierBundle, t: DossierTheme, ctx: SectionCtx): Content[] {
  const { documents } = b
  const out: Content[] = [sectionHeading(t, 'Phụ lục — bản chụp giấy tờ hành nghề', ctx.ordinal)]

  if (documents.length === 0) {
    out.push(emptyNote(t, 'Chưa khai báo giấy tờ hành nghề.'))
    return out
  }

  const COLS = t.annexCols
  const CELL_W = (PAGE_W - MARGIN * 2 - 16) / COLS
  const SHOT_H = t.annexShotHeight

  const rows: TableCell[][] = []
  for (let i = 0; i < documents.length; i += COLS) {
    const chunk = documents.slice(i, i + COLS)
    const cells: TableCell[] = chunk.map((d) => {
      const scan = ctx.img.docScans[d.id]
      const st = docExpiryLabel(t, d.expiryDate)
      // Khung ảnh CAO ĐỀU bất kể ảnh dọc hay ngang: thiết kế đặt
      // `.annex .shot{height:276px}` cố định, ảnh canh giữa bên trong. Dùng
      // `fit` trần sẽ khiến các thẻ so le chiều cao và lưới vỡ nhịp.
      const shot: Content = {
        table: {
          widths: [CELL_W],
          heights: [SHOT_H],
          body: [[{
            fillColor: t.scanBg,
            border: [false, false, false, true],
            margin: [4, 4, 4, 4],
            ...(scan
              ? { image: scan, fit: [CELL_W - 10, SHOT_H - 10], alignment: 'center' }
              : { text: 'chưa có bản chụp', fontSize: 7, color: t.muted, alignment: 'center', margin: [0, SHOT_H / 2 - 8, 0, 0] }),
          }]],
        },
        layout: {
          hLineColor: () => t.line, vLineColor: () => t.line,
          hLineWidth: (i: number) => (i === 1 ? 0.7 : 0), vLineWidth: () => 0,
          paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
        },
      }
      return {
        stack: [
          shot,
          {
            margin: [7, 6, 7, 8],
            stack: [
              { text: DOC_TYPE_LABELS[d.docType], fontSize: 8.5, bold: true, lineHeight: 1.25 },
              // Thiết kế đặt số hiệu trên dòng riêng, rồi "nơi cấp · ngày" bên dưới.
              ...(d.docNumber
                ? [{ text: d.docNumber, fontSize: 7, color: t.muted, margin: [0, 3, 0, 0] as [number, number, number, number] }]
                : []),
              {
                text: [d.issuer, fmtDate(d.issuedDate)].filter(Boolean).join(' · '),
                fontSize: 7, color: t.muted, margin: [0, d.docNumber ? 1 : 3, 0, 0], lineHeight: 1.35,
              },
              { text: st.text, fontSize: 7.5, color: st.color, margin: [0, 4, 0, 0] },
            ],
          },
        ],
      }
    })
    while (cells.length < COLS) cells.push({ text: '', border: [false, false, false, false] })
    rows.push(cells)
  }

  out.push({
    table: { widths: Array(COLS).fill('*'), body: rows },
    layout: {
      hLineColor: () => t.line, vLineColor: () => t.line,
      hLineWidth: () => 0.7, vLineWidth: () => 0.7,
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
  })

  out.push({
    text: `Mỗi giấy tờ hành nghề bắt buộc có bản chụp đính kèm. Ảnh gốc độ phân giải đầy đủ xem trực tiếp trên hệ thống · ${ctx.refNo}.`,
    fontSize: 7.5, italics: true, color: t.muted, margin: [0, 10, 0, 0],
  })

  return out
}

export const SECTION_BUILDERS: Record<
  DossierSectionId,
  (b: DossierBundle, t: DossierTheme, ctx: SectionCtx) => Content[]
> = { strengths, education, notable, cpd, rewards, identity, practice, annex }
