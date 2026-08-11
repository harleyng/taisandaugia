// Khối dựng dùng chung cho mọi mẫu.
//
// Toàn bộ hàm ở đây nhận `t: DossierTheme` làm tham số đầu và KHÔNG được
// hardcode màu — rẽ nhánh phong cách nằm gọn trong từng khối, không rải ra
// tầng lắp ráp.

import type { Content, TableCell } from 'pdfmake/interfaces'
import { CS, type DossierTheme } from './theme'

// Thiết kế dùng dd/MM/yyyy ĐỦ 2 CHỮ SỐ ('14/05/2008', '01/03/2016').
// toLocaleDateString('vi-VN') bỏ số 0 đứng đầu ⇒ '14/5/2008', lệch nhịp cột.
export const fmtDate = (d?: string) => {
  if (!d) return '—'
  const t = new Date(d)
  if (isNaN(t.getTime())) return '—'
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(t.getDate())}/${p2(t.getMonth() + 1)}/${t.getFullYear()}`
}

// Bản in dùng quy ước vi-VN: chấm ngăn nghìn, phẩy thập phân
// ('86.400.000.000 ₫', '+65,4%'). Khác quy ước dấu phẩy của các màn nhập liệu
// trong app — cố ý, và chỉ áp trong file xuất này.
export const groupDots = (n: number) => Math.round(n).toLocaleString('de-DE')
export const money = (n?: number) => (n ? `${groupDots(n)} ₫` : '—')
export const pct = (n: number, sign = false) =>
  `${sign && n >= 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')}%`

/** Rút gọn tiền về tỷ cho ô chỉ số — "1.842" dễ đọc hơn "1.842.000.000.000 ₫". */
export function billions(n: number): string {
  if (!n) return '0'
  return (n / 1_000_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

export function sectionHeading(t: DossierTheme, text: string, ordinal = 0): Content {
  if (t.heading === 'ROMAN_CENTERED') {
    return {
      text: `${ROMAN[ordinal] ?? ordinal}. ${text.toUpperCase()}`,
      fontSize: 9, bold: true, color: t.brand, alignment: 'center',
      characterSpacing: CS.heading,
      margin: [0, t.headingGap, 0, 8],
    }
  }

  if (t.heading === 'QUIET') {
    return {
      text: text.toUpperCase(),
      fontSize: 7.5, bold: true, color: t.muted, characterSpacing: CS.heading,
      margin: [0, t.headingGap, 0, 5],
    }
  }

  // HTML: `h2{display:flex}` + `h2:after{flex:1;height:1px}` — kẻ nằm BÊN PHẢI
  // chữ và canh giữa theo chiều cao, KHÔNG phải kẻ trên/dưới cả hàng.
  // Bản trước dùng bảng với `hLineWidth: () => 0.7`, hàm này trả 0.7 cho mọi
  // cạnh kể cả cạnh TRÊN (i=0) ⇒ đẻ ra một vệt gạch phía trên tiêu đề.
  return {
    margin: [0, t.headingGap, 0, 8],
    columns: [
      { text: text.toUpperCase(), width: 'auto', fontSize: 8.5, bold: true, color: t.brand, characterSpacing: CS.heading },
      {
        width: '*',
        margin: [10, 4.5, 0, 0],
        table: { widths: ['*'], body: [[{ text: '', fontSize: 1, border: [false, false, false, true] }]] },
        layout: {
          hLineColor: () => t.line,
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
export function section(t: DossierTheme, title: string, ordinal: number, body: Content): Content {
  return { unbreakable: true, stack: [sectionHeading(t, title, ordinal), body] }
}

/** Lưới nhãn/giá trị 2 cột, mỗi dòng có kẻ chân mảnh. */
export function infoGrid(t: DossierTheme, rows: [string, string][]): Content {
  // CSS `grid-template-columns:1fr 1fr` đổ phần tử theo HÀNG (trái, phải, trái,
  // phải…), KHÔNG phải cắt đôi mảng rồi xếp cột. Bản trước cắt đôi nên thứ tự
  // trường lệch hoàn toàn so với thiết kế.
  const pairs: Array<[[string, string] | null, [string, string] | null]> = []
  for (let i = 0; i < rows.length; i += 2) pairs.push([rows[i] ?? null, rows[i + 1] ?? null])

  if (t.table === 'BOXED') {
    // Kiểu biểu mẫu hành chính: ô kẻ kín, giá trị canh trái ngay sau nhãn.
    const cell = (r: [string, string] | null, isLabel: boolean): TableCell =>
      r
        ? isLabel
          ? { text: r[0], fontSize: 8.5, color: t.muted, margin: [4, 3, 4, 3] }
          : { text: r[1] || '—', fontSize: 8.5, margin: [4, 3, 4, 3] }
        : { text: '', margin: [4, 3, 4, 3] }
    return {
      unbreakable: true,
      table: {
        widths: ['auto', '*', 'auto', '*'],
        body: pairs.map(([l, r]) => [cell(l, true), cell(l, false), cell(r, true), cell(r, false)]),
      },
      layout: {
        hLineColor: () => t.line, vLineColor: () => t.line,
        hLineWidth: () => 0.6, vLineWidth: () => 0.6,
        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
      },
    }
  }

  const cell = (r: [string, string] | null, isLabel: boolean): TableCell => {
    if (!r) return { text: '', border: [false, false, false, false] }
    return isLabel
      ? { text: r[0], fontSize: 8.5, color: t.muted, margin: [0, 3, 0, 3] }
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
      hLineColor: () => t.line2,
      // Kẻ chân từng dòng, trừ dòng cuối; cột đệm giữa không có kẻ.
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
        i === 0 || i === node.table.body.length ? 0 : 0.6,
      vLineWidth: () => 0,
      paddingLeft: () => 0, paddingRight: () => 0,
      paddingTop: () => 0, paddingBottom: () => 0,
    },
  }
}

/** Thẻ viền trái đậm (hoặc ô kẻ trơn) — dùng cho sở trường và trình độ. */
export function cardGrid(
  t: DossierTheme,
  items: Array<{ title: string; meta: string }>,
  cols: number,
  accent?: string,
): Content {
  if (items.length === 0) return { text: '—', fontSize: 9, color: t.muted, italics: true }
  const bar = accent ?? t.accent
  const rows: TableCell[][] = []
  for (let i = 0; i < items.length; i += cols) {
    const chunk = items.slice(i, i + cols)
    // Chú kiểu trả về của callback: nếu không, TS suy `border`/`margin` thành
    // boolean[]/number[] thay vì tuple 4 phần tử mà pdfmake yêu cầu.
    const cells: TableCell[] = chunk.map((it): TableCell => {
      const body: Content[] = [
        { text: it.title, fontSize: 9, bold: true },
        { text: it.meta, fontSize: 8, color: t.muted, margin: [0, 2, 0, 0] },
      ]
      if (t.cards === 'PLAIN_BOX') {
        return { stack: body, margin: [7, 5, 5, 5] }
      }
      return {
        // Viền trái màu mô phỏng border-left:3px của thiết kế.
        table: {
          widths: [2, '*'],
          body: [[
            { text: '', fillColor: bar, border: [false, false, false, false] },
            { stack: body, border: [false, false, false, false], margin: [7, 5, 5, 5] },
          ]],
        },
        layout: { defaultBorder: false, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
      }
    })
    while (cells.length < cols) cells.push({ text: '', border: [false, false, false, false] })
    rows.push(cells)
  }
  return {
    unbreakable: true,
    table: { widths: Array(cols).fill('*'), body: rows },
    layout: {
      hLineColor: () => t.line, vLineColor: () => t.line,
      hLineWidth: () => 0.7, vLineWidth: () => 0.7,
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 2],
  }
}

/**
 * Dòng thời gian: chấm tròn viền màu nhấn nằm trên một đường kẻ dọc, bên phải
 * là ngày · nội dung · nhãn bo tròn. Thiết kế dùng dạng này cho Khen thưởng
 * thay vì bảng — bảng làm mục này trông như dữ liệu tra cứu, không phải thành
 * tích.
 */
export function timeline(
  t: DossierTheme,
  rows: Array<{ date: string; title: string; meta: string; flag: string; warn?: boolean }>,
): Content {
  return {
    table: {
      // Một mốc KHÔNG được vỡ đôi qua trang: mẫu chảy tự do (Hành chính, Tối
      // giản) từng để lại dòng tên ở cuối trang còn cấp quyết định nằm mồ côi
      // đầu trang sau, kèm một đoạn kẻ dọc cụt.
      dontBreakRows: true,
      widths: [9, 62, '*', 'auto'],
      // Chú kiểu để border/margin suy ra tuple, không phải boolean[]/number[].
      body: rows.map((r): TableCell[] => [
        {
          // Tâm chấm đặt đúng x=9 — cạnh phải cột 0, cũng là nơi vẽ đường kẻ
          // dọc — để chấm nằm TRÊN đường kẻ như `.tlrow:before` của thiết kế.
          canvas: [{ type: 'ellipse', x: 9, y: 9.5, r1: 2.6, r2: 2.6, lineWidth: 1, lineColor: t.brand, color: '#ffffff' }],
          border: [false, false, true, false],
        },
        { text: r.date, fontSize: 8, color: t.muted, margin: [8, 4, 0, 6] },
        {
          margin: [0, 4, 0, 6],
          stack: [
            { text: r.title, fontSize: 8.5, bold: true },
            { text: r.meta, fontSize: 8, color: t.muted, margin: [0, 2, 0, 0] },
          ],
        },
        {
          margin: [0, 4, 0, 6],
          table: { widths: ['*'], body: [[{
            text: r.flag.toUpperCase(), fontSize: 6.5, characterSpacing: CS.flag,
            color: r.warn ? t.warn : t.accent,
            ...(t.chip === 'FILLED'
              ? { fillColor: r.warn ? t.warnSoft : t.accentSoft, border: [false, false, false, false] as [boolean, boolean, boolean, boolean] }
              : { border: [true, true, true, true] as [boolean, boolean, boolean, boolean] }),
            alignment: 'center', margin: [6, 3, 6, 3],
          }]] },
          layout: {
            defaultBorder: t.chip !== 'FILLED',
            hLineColor: () => t.line, vLineColor: () => t.line,
            hLineWidth: () => (t.chip === 'FILLED' ? 0 : 0.6),
            vLineWidth: () => (t.chip === 'FILLED' ? 0 : 0.6),
            paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
          },
        },
      ]),
    },
    layout: {
      // Đường kẻ dọc chạy qua các chấm + kẻ chân mảnh mỗi mốc.
      hLineColor: () => t.line2,
      vLineColor: () => t.line,
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === node.table.body.length ? 0 : 0.6),
      vLineWidth: (i: number) => (i === 1 ? 0.7 : 0),
      paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
    },
  }
}

/** Bảng dữ liệu: đầu bảng gạch chân màu nhấn (hoặc kẻ viền kín cho mẫu hành chính). */
export function dataTable(
  t: DossierTheme,
  headers: Array<{ text: string; align?: 'left' | 'right'; width?: string | number }>,
  rows: TableCell[][],
): Content {
  const boxed = t.table === 'BOXED'
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
          fontSize: 7.5, bold: true, color: boxed ? t.brand : t.muted, characterSpacing: CS.tableHead,
          alignment: h.align ?? 'left',
          margin: [0, 0, 0, boxed ? 0 : 5],
        })),
        ...rows,
      ],
    },
    layout: {
      hLineColor: (i: number) => (!boxed && i === 1 ? t.brand : boxed ? t.line : t.line2),
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
        boxed ? 0.6 : i === 0 ? 0 : i === 1 ? 0.9 : i === node.table.body.length ? 0 : 0.6,
      vLineColor: () => t.line,
      vLineWidth: () => (boxed ? 0.6 : 0),
      paddingLeft: (i: number) => (boxed || i > 0 ? 5 : 0),
      paddingRight: () => 5,
      paddingTop: () => 5, paddingBottom: () => 5,
    },
  }
}
