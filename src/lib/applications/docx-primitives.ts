// Khối dựng DOCX dùng chung. Tách khỏi export-docx.ts để hồ sơ nhân sự
// (src/lib/personnel/export-dossier.ts) dùng lại cùng một bộ typography/bảng,
// tránh hai style file Word khác nhau cho cùng một tổ chức.

import {
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx'

export function h1(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160 } })
}

export function h2(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 } })
}

export function h3(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 80 } })
}

export function p(text: string, bold = false, indent = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text || '—', bold, size: 24 })],
    spacing: { after: 100 },
    indent: indent ? { left: 360 } : undefined,
  })
}

export function paras(text: string): Paragraph[] {
  if (!text || !text.trim()) return [p('—')]
  return text.split('\n').map((line) => p(line))
}

export function divider(): Paragraph {
  return new Paragraph({
    border: { bottom: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 4 } },
    spacing: { after: 160 },
  })
}

export function infoTable(rows: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              children: [p(label, true)],
              width: { size: 32, type: WidthType.PERCENTAGE },
            }),
            new TableCell({
              children: [p(value || '—')],
              width: { size: 68, type: WidthType.PERCENTAGE },
            }),
          ],
        })
    ),
  })
}

export function dataTable(headers: string[], rows: string[][]): Table {
  const headerRow = new TableRow({
    children: headers.map(
      (h) =>
        new TableCell({
          children: [p(h, true)],
          shading: { fill: 'F0F4F8' },
        })
    ),
  })
  const dataRows = rows.map(
    (cells) =>
      new TableRow({
        children: cells.map((c) => new TableCell({ children: [p(c || '—')] })),
      })
  )
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  })
}
