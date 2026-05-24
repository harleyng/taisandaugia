import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Packer,
} from 'docx'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { Application, ExportFormat } from '@/types/application'
import { CapacityProfile } from '@/types/capacity-profile'
import { ASSET_CATEGORY_LABELS } from './labels'

function heading(text: string, level: HeadingLevel = HeadingLevel.HEADING_1): Paragraph {
  return new Paragraph({ text, heading: level, spacing: { before: 240, after: 120 } })
}

function para(text: string, bold = false, indent = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold, size: 24 })],
    spacing: { after: 120 },
    indent: indent ? { left: 360 } : undefined,
  })
}

function divider(): Paragraph {
  return new Paragraph({
    border: { bottom: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 6 } },
    spacing: { after: 160 },
  })
}

function buildCapacityDoc(app: Application, profile: CapacityProfile): Document {
  const { announcement, capacitySnapshot, auctionPlan } = app

  const tableRows = [
    ['Loại tài sản', ASSET_CATEGORY_LABELS[announcement.assetCategory as string] ?? announcement.assetCategory],
    ['Người có tài sản', announcement.ownerName],
    ['Mô tả tài sản', announcement.assetDescription],
    ['Giá khởi điểm', Number(announcement.startingPrice).toLocaleString('vi-VN') + ' đồng'],
    ['Tỉnh/thành', announcement.province],
    ['Hạn nộp hồ sơ', announcement.deadline ? new Date(announcement.deadline).toLocaleDateString('vi-VN') : ''],
  ]

  return new Document({
    sections: [
      {
        children: [
          heading('HỒ SƠ NĂNG LỰC'),
          heading('I. THÔNG TIN TỔ CHỨC ĐẤU GIÁ', HeadingLevel.HEADING_2),
          para(`Tổ chức đăng ký danh sách Bộ Tư pháp: ${profile.onMinistryList ? 'Có' : 'Chưa'}`),
          divider(),
          heading('II. CƠ SỞ VẬT CHẤT', HeadingLevel.HEADING_2),
          para(`Điểm Mục II: ${capacitySnapshot.scoreII}/19`),
          divider(),
          heading('IV. KINH NGHIỆM VÀ NĂNG LỰC', HeadingLevel.HEADING_2),
          para(`Số cuộc đấu giá đã tổ chức: ${profile.auctionsCompleted}`, false, true),
          para(`Điểm Mục IV.1-4: ${capacitySnapshot.scoreIV1to4}/21`, false, true),
          para(`Thời gian hoạt động: ${profile.yearsActive} năm — Điểm Mục IV.5: ${capacitySnapshot.scoreIV5}/5`, false, true),
          para(`Số đấu giá viên: ${profile.auctioneerCount} — Điểm Mục IV.6-8: ${capacitySnapshot.scoreIV6to8}/9`, false, true),
          para(`Thuế năm trước: ${profile.taxPaidPreviousYear} triệu VND — Điểm Mục IV.9: ${capacitySnapshot.scoreIV9}/3`, false, true),
          divider(),
          heading('THÔNG TIN TÀI SẢN ĐẤU GIÁ', HeadingLevel.HEADING_2),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows.map(
              ([label, value]) =>
                new TableRow({
                  children: [
                    new TableCell({ children: [para(label, true)], width: { size: 30, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [para(value)], width: { size: 70, type: WidthType.PERCENTAGE } }),
                  ],
                })
            ),
          }),
        ],
      },
    ],
  })
}

function buildAuctionPlanDoc(app: Application): Document {
  const p = app.auctionPlan
  const v = app.sectionVCriteria

  const criteriaRows = v.map((c) =>
    new TableRow({
      children: [
        new TableCell({ children: [para(c.label)] }),
        new TableCell({ children: [para(c.maxPoints.toString(), true)] }),
        new TableCell({ children: [para(c.meets === true ? 'Đáp ứng' : c.meets === false ? 'Không' : 'Chưa xác định')] }),
        new TableCell({ children: [para(c.evidence)] }),
      ],
    })
  )

  return new Document({
    sections: [
      {
        children: [
          heading('PHƯƠNG ÁN ĐẤU GIÁ'),
          heading('III. PHƯƠNG ÁN ĐẤU GIÁ (16 ĐIỂM)', HeadingLevel.HEADING_2),
          heading('III.1. Hình thức, bước giá, số vòng (8đ)', HeadingLevel.HEADING_3),
          para(p.format),
          divider(),
          heading('III.2. Bán, tiếp nhận hồ sơ (2đ)', HeadingLevel.HEADING_3),
          para(p.receptionPlan),
          divider(),
          heading('III.3. Đối tượng, điều kiện tham gia (3đ)', HeadingLevel.HEADING_3),
          para(p.participantConditions),
          divider(),
          heading('III.4. Giải pháp giám sát, chống thông đồng (3đ)', HeadingLevel.HEADING_3),
          para(p.antiCollusionMeasures),
          divider(),
          ...(v.length > 0
            ? [
                heading('V. TIÊU CHÍ KHÁC (8 ĐIỂM)', HeadingLevel.HEADING_2),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({
                      children: [
                        new TableCell({ children: [para('Tiêu chí', true)] }),
                        new TableCell({ children: [para('Điểm', true)] }),
                        new TableCell({ children: [para('Đáp ứng', true)] }),
                        new TableCell({ children: [para('Bằng chứng', true)] }),
                      ],
                    }),
                    ...criteriaRows,
                  ],
                }),
              ]
            : []),
        ],
      },
    ],
  })
}


function buildIntegratedDoc(app: Application, profile: CapacityProfile): Document {
  const cap = buildCapacityDoc(app, profile)
  const plan = buildAuctionPlanDoc(app)
  return new Document({
    sections: [
      ...cap.sections,
      ...plan.sections,
    ],
  })
}

export async function generateExport(
  app: Application,
  profile: CapacityProfile,
  format: ExportFormat
): Promise<void> {
  const safeTitle = (app.announcement.ownerName || 'HoSo').replace(/[^a-zA-Z0-9À-ỹ\s]/g, '').trim().slice(0, 30)
  const dateStr = new Date().toISOString().slice(0, 10)

  if (format === 'SEPARATED') {
    const zip = new JSZip()

    const capDoc = buildCapacityDoc(app, profile)
    const planDoc = buildAuctionPlanDoc(app)

    const [capBuffer, planBuffer] = await Promise.all([
      Packer.toBlob(capDoc),
      Packer.toBlob(planDoc),
    ])

    zip.file('01_Ho-so-nang-luc.docx', capBuffer)
    zip.file('02_Phuong-an-dau-gia.docx', planBuffer)

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    saveAs(zipBlob, `HoSo-${safeTitle}-${dateStr}.zip`)
  } else {
    const doc = buildIntegratedDoc(app, profile)
    const blob = await Packer.toBlob(doc)
    saveAs(blob, `HoSo-Tich-hop-${safeTitle}-${dateStr}.docx`)
  }
}
