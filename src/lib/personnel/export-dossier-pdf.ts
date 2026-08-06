// Hồ sơ đấu giá viên — mẫu xuất PDF "Năng lực", 3 trang A4.
//
// Dựng theo thiết kế `Ho So Nhan Su - Mau Xuat PDF.html` (Claude Design):
//   Trang 1 — hero navy + ảnh 3×4, dải 4 chỉ số, sở trường, đào tạo, cuộc tiêu biểu
//   Trang 2 — bồi dưỡng, khen thưởng, định danh, hành nghề
//   Trang 3 — phụ lục bản chụp giấy tờ hành nghề (lưới 3 cột)
//
// Chữ: Lora cho tên và số liệu lớn (nạp từ assets), Roboto cho phần còn lại —
// cả hai đều phủ đủ dấu tiếng Việt. Thiết kế gốc dùng Be Vietnam Pro cho thân
// chữ; Roboto thay vào để khỏi gánh thêm một font nữa vào bundle.

import type { TDocumentDefinitions, Content, TableCell } from 'pdfmake/interfaces'
import type { DossierBundle } from './dossier-content'
import { auctionStats, notableAuctions, categoryLabel } from './auction-source'
import { POSITION_LABELS, computePracticeYears } from '@/types/auctioneer'
import {
  DOC_TYPE_LABELS, GENDER_LABELS, ID_TYPE_LABELS,
} from '@/types/personnel'
import type { DossierEvent } from '@/types/personnel'
import { EMPTY_CPD_CATALOG } from '@/types/cpd-catalog'
import { creditedHoursOf, formLabel, indexCatalog, makeCpdResolver } from './cpd-catalog'
import { trainingCompliance } from './completeness'
import { progressHours } from './cpd'
import { groupNumber } from '@/components/asset-posting/format'
import { loadLoraFonts, docPathToDataUrl, urlToDataUrl } from './pdf-assets'

// Bảng màu lấy nguyên từ thiết kế.
const NAVY = '#0a3d7a'
const INK = '#101720'
const MUTED = '#6b7887'
const LINE = '#d8dfe8'
const LINE_2 = '#eef2f7'
const AMBER = '#c8901a'
const AMBER_L = '#fbf3e0'
const GREEN = '#12694a'
const GREEN_BG = '#effaf4'
const WARN = '#a35a08'
const SCAN_BG = '#f1f4f8'

const PAGE_W = 595.28 // A4 pt
const MARGIN = 40
// Chiều cao dải hero trang 1 — background vẽ theo hằng này nên phải khớp với
// chiều cao thật của khối nội dung hero bên dưới.
const HERO_H = 196
// Ảnh chân dung 118×157px trong trang 794px của thiết kế ⇒ 88×118pt trên A4.
const PORTRAIT_W = 88
const PORTRAIT_H = 118

// Thiết kế dùng dd/MM/yyyy ĐỦ 2 CHỮ SỐ ('14/05/2008', '01/03/2016').
// toLocaleDateString('vi-VN') bỏ số 0 đứng đầu ⇒ '14/5/2008', lệch nhịp cột.
const fmtDate = (d?: string) => {
  if (!d) return '—'
  const t = new Date(d)
  if (isNaN(t.getTime())) return '—'
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(t.getDate())}/${p2(t.getMonth() + 1)}/${t.getFullYear()}`
}

// letter-spacing của thiết kế quy từ em sang pt theo cỡ chữ tương ứng.
const CS = {
  heroTop: 7.5 * 0.14,
  kicker: 7.5 * 0.18,
  statLabel: 6.8 * 0.06,
  heading: 8.5 * 0.09,
  tableHead: 7.5 * 0.05,
  flag: 6.5 * 0.04,
}

// Thiết kế dùng quy ước vi-VN cho VĂN BẢN in: chấm ngăn nghìn, phẩy thập phân
// ('86.400.000.000 ₫', '+65,4%'). Khác quy ước dấu phẩy của các màn nhập liệu
// trong app — cố ý, và chỉ áp trong file xuất này.
const groupDots = (n: number) => Math.round(n).toLocaleString('de-DE')
const money = (n?: number) => (n ? `${groupDots(n)} ₫` : '—')
const pct = (n: number, sign = false) =>
  `${sign && n >= 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')}%`

/** Rút gọn tiền về tỷ cho ô chỉ số — "1.842" dễ đọc hơn "1.842.000.000.000 ₫". */
function billions(n: number): string {
  if (!n) return '0'
  return (n / 1_000_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })
}

export interface DossierImages {
  portrait: string | null
  /** dataURL bản chụp theo id giấy tờ; thiếu thì vẽ ô gạch chéo. */
  docScans: Record<string, string | null>
}

// ─── Khối dựng nhỏ ───────────────────────────────────────────────────────────

function sectionHeading(text: string): Content {
  // HTML: `h2{display:flex}` + `h2:after{flex:1;height:1px}` — kẻ nằm BÊN PHẢI
  // chữ và canh giữa theo chiều cao, KHÔNG phải kẻ trên/dưới cả hàng.
  // Bản trước dùng bảng với `hLineWidth: () => 0.7`, hàm này trả 0.7 cho mọi
  // cạnh kể cả cạnh TRÊN (i=0) ⇒ đẻ ra một vệt gạch phía trên tiêu đề.
  return {
    margin: [0, 18, 0, 8],
    columns: [
      { text: text.toUpperCase(), width: 'auto', fontSize: 8.5, bold: true, color: NAVY, characterSpacing: CS.heading },
      {
        width: '*',
        margin: [10, 4.5, 0, 0],
        table: { widths: ['*'], body: [[{ text: '', fontSize: 1, border: [false, false, false, true] }]] },
        layout: {
          hLineColor: () => LINE,
          hLineWidth: (i: number) => (i === 1 ? 0.7 : 0),
          vLineWidth: () => 0,
          paddingLeft: () => 0, paddingRight: () => 0,
          paddingTop: () => 0, paddingBottom: () => 0,
        },
      },
    ],
  }
}

/**
 * Buộc tiêu đề đi cùng phần thân của nó.
 * Không có cái này, tiêu đề bị bỏ lại cuối trang còn nội dung nhảy sang trang
 * sau — trang trước hụt, trang sau mở đầu bằng một bảng không rõ của mục nào.
 */
function section(title: string, body: Content): Content {
  return { unbreakable: true, stack: [sectionHeading(title), body] }
}

/** Lưới nhãn/giá trị 2 cột, mỗi dòng có kẻ chân mảnh. */
function infoGrid(rows: [string, string][]): Content {
  // CSS `grid-template-columns:1fr 1fr` đổ phần tử theo HÀNG (trái, phải, trái,
  // phải…), KHÔNG phải cắt đôi mảng rồi xếp cột. Bản trước cắt đôi nên thứ tự
  // trường lệch hoàn toàn so với thiết kế.
  const pairs: Array<[[string, string] | null, [string, string] | null]> = []
  for (let i = 0; i < rows.length; i += 2) pairs.push([rows[i] ?? null, rows[i + 1] ?? null])

  const cell = (r: [string, string] | null, isLabel: boolean): TableCell => {
    if (!r) return { text: '', border: [false, false, false, false] }
    return isLabel
      ? { text: r[0], fontSize: 8.5, color: MUTED, margin: [0, 3, 0, 3] }
      : { text: r[1] || '—', fontSize: 8.5, alignment: 'right', margin: [0, 3, 0, 3] }
  }

  return {
    unbreakable: true,
    table: {
      widths: ['*', 'auto', 26, '*', 'auto'],
      body: pairs.map(([l, r]) => [
        cell(l, true), cell(l, false),
        { text: '', border: [false, false, false, false] },
        cell(r, true), cell(r, false),
      ]),
    },
    layout: {
      hLineColor: () => LINE_2,
      // Kẻ chân từng dòng, trừ dòng cuối; cột đệm giữa không có kẻ.
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
        i === 0 || i === node.table.body.length ? 0 : 0.6,
      vLineWidth: () => 0,
      paddingLeft: () => 0, paddingRight: () => 0,
      paddingTop: () => 0, paddingBottom: () => 0,
    },
  }
}

/** Thẻ viền trái đậm — dùng cho sở trường và trình độ. */
function cardGrid(
  items: Array<{ title: string; meta: string }>,
  cols: number,
  accent = AMBER,
): Content {
  if (items.length === 0) return { text: '—', fontSize: 9, color: MUTED, italics: true }
  const rows: TableCell[][] = []
  for (let i = 0; i < items.length; i += cols) {
    const chunk = items.slice(i, i + cols)
    // Chú kiểu trả về của callback: nếu không, TS suy `border`/`margin` thành
    // boolean[]/number[] thay vì tuple 4 phần tử mà pdfmake yêu cầu.
    const cells: TableCell[] = chunk.map((it): TableCell => ({
      // Viền trái màu mô phỏng border-left:3px của thiết kế.
      table: {
        widths: [2, '*'],
        body: [[
          { text: '', fillColor: accent, border: [false, false, false, false] },
          {
            stack: [
              { text: it.title, fontSize: 9, bold: true },
              { text: it.meta, fontSize: 8, color: MUTED, margin: [0, 2, 0, 0] },
            ],
            border: [false, false, false, false],
            margin: [7, 5, 5, 5],
          },
        ]],
      },
      layout: { defaultBorder: false, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
    }))
    while (cells.length < cols) cells.push({ text: '', border: [false, false, false, false] })
    rows.push(cells)
  }
  return {
    unbreakable: true,
    table: { widths: Array(cols).fill('*'), body: rows },
    layout: {
      hLineColor: () => LINE, vLineColor: () => LINE,
      hLineWidth: () => 0.7, vLineWidth: () => 0.7,
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 2],
  }
}

/**
 * Dòng thời gian: chấm tròn viền navy nằm trên một đường kẻ dọc, bên phải là
 * ngày · nội dung · nhãn bo tròn. Thiết kế dùng dạng này cho Khen thưởng thay
 * vì bảng — bảng làm mục này trông như dữ liệu tra cứu, không phải thành tích.
 */
function timeline(
  rows: Array<{ date: string; title: string; meta: string; flag: string; warn?: boolean }>,
): Content {
  return {
    table: {
      widths: [9, 62, '*', 'auto'],
      // Chú kiểu để border/margin suy ra tuple, không phải boolean[]/number[].
      body: rows.map((r): TableCell[] => [
        {
          // Tâm chấm đặt đúng x=9 — cạnh phải cột 0, cũng là nơi vẽ đường kẻ
          // dọc — để chấm nằm TRÊN đường kẻ như `.tlrow:before` của thiết kế.
          canvas: [{ type: 'ellipse', x: 9, y: 9.5, r1: 2.6, r2: 2.6, lineWidth: 1, lineColor: NAVY, color: '#ffffff' }],
          border: [false, false, true, false],
        },
        { text: r.date, fontSize: 8, color: MUTED, margin: [8, 4, 0, 6] },
        {
          margin: [0, 4, 0, 6],
          stack: [
            { text: r.title, fontSize: 8.5, bold: true },
            { text: r.meta, fontSize: 8, color: MUTED, margin: [0, 2, 0, 0] },
          ],
        },
        {
          margin: [0, 4, 0, 6],
          table: { widths: ['*'], body: [[{
            text: r.flag.toUpperCase(), fontSize: 6.5, characterSpacing: CS.flag,
            color: r.warn ? WARN : AMBER, fillColor: r.warn ? '#fdf0e3' : AMBER_L,
            alignment: 'center', border: [false, false, false, false], margin: [6, 3, 6, 3],
          }]] },
          layout: { defaultBorder: false, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
        },
      ]),
    },
    layout: {
      // Đường kẻ dọc chạy qua các chấm + kẻ chân mảnh mỗi mốc.
      hLineColor: () => LINE_2,
      vLineColor: () => LINE,
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === node.table.body.length ? 0 : 0.6),
      vLineWidth: (i: number) => (i === 1 ? 0.7 : 0),
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
  }
}

/** Bảng dữ liệu: đầu bảng gạch chân navy, thân kẻ mảnh. */
function dataTable(headers: Array<{ text: string; align?: 'left' | 'right'; width?: string | number }>, rows: TableCell[][]): Content {
  return {
    table: {
      headerRows: 1,
      // Không cho một dòng vỡ đôi qua trang — bản trước để lại đầu bảng mồ côi
      // cùng nửa dòng trên một trang gần như trống.
      dontBreakRows: true,
      widths: headers.map((h) => h.width ?? '*'),
      body: [
        headers.map((h) => ({
          text: h.text.toUpperCase(),
          fontSize: 7.5, bold: true, color: MUTED, characterSpacing: CS.tableHead,
          alignment: h.align ?? 'left',
          margin: [0, 0, 0, 5],
        })),
        ...rows,
      ],
    },
    layout: {
      hLineColor: (i: number) => (i === 1 ? NAVY : LINE_2),
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
        i === 0 ? 0 : i === 1 ? 0.9 : i === node.table.body.length ? 0 : 0.6,
      vLineWidth: () => 0,
      paddingLeft: (i: number) => (i === 0 ? 0 : 5),
      paddingRight: () => 5,
      paddingTop: () => 5, paddingBottom: () => 5,
    },
  }
}

// ─── Trang 1 ─────────────────────────────────────────────────────────────────

function heroBlock(b: DossierBundle, orgName: string, refNo: string, img: DossierImages): Content {
  const { person } = b
  const years = computePracticeYears(person)
  const role = person.publicTitle?.trim() || POSITION_LABELS[person.position]

  const portrait: Content = img.portrait
    ? { image: img.portrait, width: PORTRAIT_W, height: PORTRAIT_H }
    : {
        // Không có ảnh thì giữ đúng khung 3×4 để bố cục không xô lệch.
        table: { widths: [PORTRAIT_W], heights: [PORTRAIT_H], body: [[{ text: 'ảnh chân dung 3×4', fontSize: 6.5, color: '#8ba6c6', alignment: 'center', margin: [0, 100, 0, 6] }]] },
        layout: { hLineColor: () => '#4a6f9e', vLineColor: () => '#4a6f9e', hLineWidth: () => 0.7, vLineWidth: () => 0.7 },
      }

  // `.heroMain{align-items:flex-end}` — ảnh và khối chữ BẰNG ĐÁY. pdfmake
  // không canh dọc được trong `columns`, nên tính chiều cao khối chữ rồi đẩy
  // xuống đúng phần chênh. Bản trước đẩy bằng một số đoán tay nên chữ tụt quá
  // đáy ảnh.
  const LH = 1.35
  const textH =
    7.5 * LH +               // kicker
    (28 * LH + 5 + 4) +      // tên + margin trên/dưới
    10 * LH +                // chức vụ
    (8.5 * LH + 1.5)         // dòng mốc hành nghề
  // Tên dài xuống 2 dòng thì khối chữ cao hơn ảnh ⇒ kẹp về 0, ảnh canh trên.
  const textTop = Math.max(0, PORTRAIT_H - textH)

  // Nền navy do `background` của trang vẽ tràn lề — fillColor trên bảng bị
  // pdfmake đặt lệch xuống so với nội dung khi có margin âm.
  return {
    margin: [0, -18, 0, 0],
    stack: [
      {
        columns: [
          { text: orgName.toUpperCase(), fontSize: 7.5, color: '#b9cbe2', characterSpacing: CS.heroTop, width: '*' },
          { text: `Hồ sơ năng lực · ${refNo}`, fontSize: 7.5, color: '#b9cbe2', characterSpacing: CS.heroTop, alignment: 'right', width: 'auto' },
        ],
      },
      {
        margin: [0, 20, 0, 0],
        columns: [
          { width: 84, stack: [portrait] },
          {
            width: '*',
            margin: [20, textTop, 0, 0],
            stack: [
              { text: `ĐẤU GIÁ VIÊN · THẺ SỐ ${person.licenseNumber}`, fontSize: 7.5, color: AMBER, characterSpacing: CS.kicker },
              // Thiết kế để tên ở dạng hoa/thường như nhập, KHÔNG in hoa toàn bộ.
              { text: person.fullName, font: 'Lora', fontSize: 28, bold: true, color: '#fff', margin: [0, 5, 0, 4] },
              { text: `${role} — ${years} năm hành nghề đấu giá`, fontSize: 10, bold: true, color: '#ffffff' },
              {
                text: [
                  `Hành nghề từ ${fmtDate(person.practiceStartDate ?? person.licenseIssuedDate)}`,
                  person.managementStartDate ? ` · Giữ chức quản lý từ ${fmtDate(person.managementStartDate)}` : '',
                ].join(''),
                fontSize: 8.5, color: '#9fb6d1', margin: [0, 1.5, 0, 0],
              },
            ],
          },
        ],
      },
    ],
  }
}

function statsStrip(b: DossierBundle): Content {
  const s = auctionStats(b.auctions)
  const successRate = s.total > 0 ? Math.round((s.successful / s.total) * 100) : 0
  const cells: Array<[string, string]> = [
    [String(s.total), 'Cuộc đã điều hành'],
    [String(s.successful), `Cuộc đấu giá thành (${successRate}%)`],
    [s.avgDiffPercent === null ? '—' : pct(s.avgDiffPercent, true),
      'Chênh lệch bình quân so giá khởi điểm'],
    [billions(s.totalWinningValue), 'Tổng giá trị trúng (tỷ đồng)'],
  ]
  return {
    // Dải chỉ số bám sát mép hero, kẻ dọc ngăn giữa các ô.
    table: {
      widths: ['*', '*', '*', '*'],
      // KHÔNG đặt `border` ở cấp ô: nó đè lên layout và xoá sạch border-right
      // giữa các chỉ số cùng border-bottom của cả dải (.stats trong HTML).
      body: [cells.map(([n, l]) => ({
        margin: [12, 14, 12, 14],
        stack: [
          { text: n, font: 'Lora', fontSize: 19, bold: true, color: NAVY },
          { text: l.toUpperCase(), fontSize: 6.8, color: MUTED, characterSpacing: CS.statLabel, margin: [0, 3, 0, 0], lineHeight: 1.25 },
        ],
      }))],
    },
    layout: {
      hLineColor: () => LINE, vLineColor: () => LINE,
      hLineWidth: (i: number) => (i === 1 ? 0.7 : 0),
      vLineWidth: (i: number) => (i === 0 || i === 4 ? 0 : 0.7),
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
    margin: [-MARGIN, 22, -MARGIN, 12],
  }
}

function page1(b: DossierBundle, orgName: string, refNo: string, img: DossierImages): Content[] {
  const { person } = b
  const stats = auctionStats(b.auctions)
  const notable = notableAuctions(b.auctions, 4)

  const eduItems = [
    { title: person.educationLevel ?? '—', meta: 'Trình độ học vấn' },
    { title: person.major ?? '—', meta: 'Chuyên ngành' },
    { title: person.almaMater ?? '—', meta: 'Cơ sở đào tạo' },
  ]

  const out: Content[] = [
    heroBlock(b, orgName, refNo, img),
    statsStrip(b),
    section('Sở trường tài sản', cardGrid(
      stats.topCategories.slice(0, 4).map((c) => ({ title: c.label, meta: `${c.count} cuộc đã điều hành` })),
      2,
    )),
    section('Đào tạo', cardGrid(eduItems, 3, NAVY)),
    sectionHeading('Cuộc đấu giá tiêu biểu'),
  ]

  if (notable.length === 0) {
    out.push({ text: 'Chưa ghi nhận cuộc đấu giá nào có chênh lệch so với giá khởi điểm.', fontSize: 9, italics: true, color: MUTED })
  } else {
    out.push(dataTable(
      [
        { text: 'Ngày', width: 52 },
        { text: 'Tài sản' },
        { text: 'Giá khởi điểm', align: 'right', width: 78 },
        { text: 'Giá trúng', align: 'right', width: 78 },
        { text: 'Chênh lệch', align: 'right', width: 78 },
      ],
      notable.map((a): TableCell[] => [
        { text: fmtDate(a.date), fontSize: 8.5 },
        {
          stack: [
            { text: a.assetDescription, fontSize: 8.5 },
            { text: categoryLabel(a.assetCategory), fontSize: 7.5, color: MUTED, margin: [0, 2, 0, 0] },
          ],
        },
        { text: money(a.startingPrice), fontSize: 8.5, alignment: 'right' },
        { text: money(a.winningPrice), fontSize: 8.5, alignment: 'right' },
        {
          stack: [
            { text: pct(a.priceDiffPercent ?? 0, true), fontSize: 8.5, bold: true, color: GREEN, alignment: 'right' },
            { text: money(a.priceDiff), fontSize: 7.5, color: MUTED, alignment: 'right' },
          ],
        },
      ]),
    ))
  }
  return out
}

// ─── Trang 2 ─────────────────────────────────────────────────────────────────

function page2(b: DossierBundle): Content[] {
  const { person, events, cpdExemptions = [], cpdCatalog = EMPTY_CPD_CATALOG } = b
  const cpdIndex = indexCatalog(cpdCatalog)
  const resolveCpd = makeCpdResolver(cpdCatalog)
  const cpdLabel = (e: DossierEvent) => formLabel(
    e.cpdActivityTypeId ? cpdIndex.typeById.get(e.cpdActivityTypeId) : undefined,
    e.cpdActivityRoleId ? cpdIndex.roleById.get(e.cpdActivityRoleId) : undefined,
  )
  const training = events.filter((e) => e.eventType === 'TRAINING')
  // Hồ sơ năng lực CHỈ in khen thưởng. Kỷ luật vẫn khai báo và tra cứu được
  // trong portal, nhưng không đưa vào bản xuất — đây là hồ sơ để nộp thầu,
  // không phải bản kiểm điểm.
  const rewards = events.filter((e) => e.eventType === 'REWARD')
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

  const out: Content[] = [
    { ...(sectionHeading('Bồi dưỡng nghiệp vụ') as object), pageBreak: 'before' } as Content,
  ]

  out.push(training.length === 0
    ? { text: 'Chưa ghi nhận khoá bồi dưỡng nào.', fontSize: 9, italics: true, color: MUTED }
    : dataTable(
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

  // Chip tuân thủ: xanh khi đủ giờ, hổ phách khi thiếu.
  out.push({
    margin: [0, 10, 0, 0],
    table: {
      widths: ['auto'],
      body: [[{
        text: `●  Tuân thủ bồi dưỡng bắt buộc (năm ${comp.year}): ${
          comp.isExempt
            ? `được miễn — ${cpdExemptName ?? 'không rõ lý do'}`
            : `${progressHours(comp)}/${comp.required} giờ — ${
                comp.ok ? 'Đạt' : `còn thiếu ${comp.required - comp.hours} giờ`
              }`
        }`,
        fontSize: 8.5, bold: true,
        color: comp.ok ? GREEN : WARN,
        fillColor: comp.ok ? GREEN_BG : AMBER_L,
        border: [false, false, false, false],
        margin: [10, 6, 10, 6],
      }]],
    },
    layout: { defaultBorder: false, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
  })

  out.push(sectionHeading('Khen thưởng'))
  out.push(rewards.length === 0
    ? { text: 'Không có.', fontSize: 9, italics: true, color: MUTED }
    : timeline(rewards.map((e) => ({
        date: fmtDate(e.startedOn),
        title: e.title,
        meta: [e.organizationName, e.referenceNo].filter(Boolean).join(' · '),
        flag: 'Khen thưởng',
      }))))

  out.push(section('Thông tin định danh', infoGrid([
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
  ])))

  out.push(section('Thông tin hành nghề', infoGrid([
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
  ])))

  return out
}

// ─── Trang 3 — phụ lục bản chụp ──────────────────────────────────────────────

function docExpiryLabel(expiry?: string): { text: string; color: string } {
  if (!expiry) return { text: 'Còn hiệu lực', color: GREEN }
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return { text: 'Đã hết hạn', color: '#b3261e' }
  if (days < 60) return { text: `Sắp hết hạn (còn ${days} ngày)`, color: WARN }
  return { text: 'Còn hiệu lực', color: GREEN }
}

function page3(b: DossierBundle, refNo: string, img: DossierImages): Content[] {
  const { documents } = b
  const out: Content[] = [
    sectionHeading('Phụ lục — bản chụp giấy tờ hành nghề'),
  ]

  if (documents.length === 0) {
    out.push({ text: 'Chưa khai báo giấy tờ hành nghề.', fontSize: 9, italics: true, color: MUTED })
    return out
  }

  const COLS = 3
  const CELL_W = (PAGE_W - MARGIN * 2 - 16) / COLS
  const SHOT_H = 138

  const rows: TableCell[][] = []
  for (let i = 0; i < documents.length; i += COLS) {
    const chunk = documents.slice(i, i + COLS)
    const cells: TableCell[] = chunk.map((d) => {
      const scan = img.docScans[d.id]
      const st = docExpiryLabel(d.expiryDate)
      // Khung ảnh CAO ĐỀU bất kể ảnh dọc hay ngang: thiết kế đặt
      // `.annex .shot{height:276px}` cố định, ảnh canh giữa bên trong. Dùng
      // `fit` trần sẽ khiến các thẻ so le chiều cao và lưới vỡ nhịp.
      const shot: Content = {
        table: {
          widths: [CELL_W],
          heights: [SHOT_H],
          body: [[{
            fillColor: SCAN_BG,
            border: [false, false, false, true],
            margin: [4, 4, 4, 4],
            ...(scan
              ? { image: scan, fit: [CELL_W - 10, SHOT_H - 10], alignment: 'center' }
              : { text: 'chưa có bản chụp', fontSize: 7, color: MUTED, alignment: 'center', margin: [0, SHOT_H / 2 - 8, 0, 0] }),
          }]],
        },
        layout: {
          hLineColor: () => LINE, vLineColor: () => LINE,
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
                ? [{ text: d.docNumber, fontSize: 7, color: MUTED, margin: [0, 3, 0, 0] as [number, number, number, number] }]
                : []),
              {
                text: [d.issuer, fmtDate(d.issuedDate)].filter(Boolean).join(' · '),
                fontSize: 7, color: MUTED, margin: [0, d.docNumber ? 1 : 3, 0, 0], lineHeight: 1.35,
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
      hLineColor: () => LINE, vLineColor: () => LINE,
      hLineWidth: () => 0.7, vLineWidth: () => 0.7,
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
  })

  out.push({
    text: `Mỗi giấy tờ hành nghề bắt buộc có bản chụp đính kèm. Ảnh gốc độ phân giải đầy đủ xem trực tiếp trên hệ thống · ${refNo}.`,
    fontSize: 7.5, italics: true, color: MUTED, margin: [0, 10, 0, 0],
  })

  return out
}

// ─── Lắp ráp ─────────────────────────────────────────────────────────────────

function buildDocDefinition(
  b: DossierBundle,
  orgName: string,
  img: DossierImages,
): TDocumentDefinitions {
  const digits = b.person.licenseNumber.replace(/\D/g, '')
  const refNo = `HSĐGV-${new Date().getFullYear()}/${(digits || '0000').slice(-4).padStart(4, '0')}`
  const exported = new Date().toLocaleString('vi-VN')

  return {
    pageSize: 'A4',
    pageMargins: [MARGIN, MARGIN, MARGIN, 46],
    background: (currentPage: number) =>
      currentPage === 1
        ? {
            canvas: [
              { type: 'rect', x: 0, y: 0, w: PAGE_W, h: HERO_H, color: NAVY },
              { type: 'rect', x: 0, y: HERO_H, w: PAGE_W, h: 4, color: AMBER },
            ],
          }
        : '',
    defaultStyle: { font: 'Roboto', fontSize: 9, color: INK, lineHeight: 1.35 },
    info: { title: `Hồ sơ đấu giá viên — ${b.person.fullName}`, author: orgName || undefined },
    content: [
      ...page1(b, orgName, refNo, img),
      ...page2(b),
      ...page3(b, refNo, img),
    ],
    footer: (currentPage: number, pageCount: number) => ({
      margin: [MARGIN, 12, MARGIN, 0],
      columns: [
        { text: `${b.person.fullName.toUpperCase()} · Hồ sơ năng lực đấu giá viên · ${exported}`, fontSize: 7, color: MUTED },
        { text: `Trang ${currentPage}/${pageCount}`, fontSize: 7, color: MUTED, alignment: 'right', width: 'auto' },
      ],
    }),
  }
}

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

/** Tải trước ảnh chân dung và bản chụp giấy tờ về dạng data URL. */
export async function loadDossierImages(b: DossierBundle): Promise<DossierImages> {
  const [portrait, ...scans] = await Promise.all([
    b.person.portraitUrl ? urlToDataUrl(b.person.portraitUrl) : Promise.resolve(null),
    ...b.documents.map((d) =>
      d.filePaths.length > 0 ? docPathToDataUrl(d.filePaths[0]) : Promise.resolve(null),
    ),
  ])
  const docScans: Record<string, string | null> = {}
  b.documents.forEach((d, i) => { docScans[d.id] = scans[i] ?? null })
  return { portrait, docScans }
}

export async function dossierPdfBlob(b: DossierBundle, orgName: string): Promise<Blob> {
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
  return pdfMake.createPdf(buildDocDefinition(b, orgName, images)).getBlob()
}
