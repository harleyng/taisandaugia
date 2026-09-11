// Cây nội dung pdfmake của dự thảo hợp đồng dịch vụ đấu giá tài sản.
//
// Thuần (không pdfmake runtime, không Supabase) để kiểm thử được. Dùng lại
// palette FORMAL + khối bảng của bản xuất hồ sơ đấu giá viên cho cùng giọng
// hành chính, in đen trắng không mất chữ.
//
// Tiền in theo formatVnd — ĐÚNG định dạng chủ tài sản đã thấy khi so sánh báo
// giá. Tổng chi phí in `terms.service_fee` (server đã tính lúc báo giá, đóng
// băng lúc chốt), KHÔNG tự cộng lại ở đây: thêm một bản sao công thức phí là
// thêm một chỗ lệch với con số trong CRM.

import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import { MARGIN, themeOf } from '@/lib/personnel/dossier-pdf/theme'
import { dataTable, fmtDate } from '@/lib/personnel/dossier-pdf/primitives'
import { AUCTION_FORMAT_LABELS, type AuctionFormat } from '@/types/asset-posting'
import { formatVnd } from '@/lib/advertising/slug'
import { planSummary } from '@/lib/quotePlan'
import type { OrgParty, OwnerParty } from '@/types/consignment-contract'
import {
  DRAFT_NOTICE, EFFECT, LEGAL_BASES, ORG_DUTIES, OWNER_DUTIES, PAYMENT_TERMS, TERMINATION,
} from './clauses'
import type { ContractPdfInput } from './input'

const t = themeOf('FORMAL')
const SIDE_MARGIN = MARGIN + 16

/** Chỗ trống để hai bên điền tay khi dữ liệu trên sàn chưa có. */
export const BLANK = '………………………………'

const val = (v?: string | number | null): string =>
  v === null || v === undefined || String(v).trim() === '' ? BLANK : String(v)

const joinAddr = (...parts: Array<string | null | undefined>) => parts.filter((p) => p && p.trim()).join(', ')

function labelRows(pairs: Array<[string, string]>): Content {
  return {
    table: {
      widths: [150, '*'],
      body: pairs.map(([label, value]): TableCell[] => [
        { text: label, color: t.muted },
        { text: value },
      ]),
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 2],
  }
}

function article(n: number, title: string, body: Content[]): Content {
  return {
    stack: [{ text: `Điều ${n}. ${title}`, bold: true, fontSize: 10.5, margin: [0, 12, 0, 5] }, ...body],
  }
}

function ownerRows(o: OwnerParty): Array<[string, string]> {
  if (o.kind === 'organization') {
    return [
      ['Tên tổ chức', val(o.org_name)],
      ['Mã số thuế / mã cơ quan', val(o.tax_code)],
      ['Địa chỉ trụ sở', val(joinAddr(o.address, o.province))],
      ['Người đại diện', val(o.rep_full_name)],
      ['Chức vụ', val(o.rep_title)],
      ['Email', val(o.email)],
    ]
  }
  return [
    ['Họ và tên', val(o.full_name)],
    [o.id_type === 'passport' ? 'Số hộ chiếu' : 'Số CCCD', val(o.id_number)],
    ['Địa chỉ', val(joinAddr(o.address, o.ward, o.province))],
    ['Điện thoại', val(o.phone)],
    ['Email', val(o.email)],
  ]
}

function orgRows(g: OrgParty): Array<[string, string]> {
  return [
    ['Tên tổ chức', val(g.name)],
    ['Mã số thuế', val(g.tax_code)],
    ['Địa chỉ', val(joinAddr(g.address, g.ward, g.district, g.province))],
    ['Điện thoại', val(g.phone)],
    ['Email', val(g.email)],
    ['Người đại diện theo pháp luật', val(g.legal_rep_name)],
    ['Chức vụ', val(g.legal_rep_position)],
  ]
}

const legalFlag = (b: boolean | null) => (b === null ? 'Chưa khai' : b ? 'Có' : 'Không')

export function buildContractDocDefinition(input: ContractPdfInput): TDocumentDefinitions {
  const { owner, org, asset, terms } = input
  const startingPrice = terms.starting_price ?? asset.starting_price
  const plan = planSummary(terms.plan, startingPrice)
  const fees = terms.fee_items ?? []
  const ownerSigner = owner.kind === 'organization' ? owner.rep_full_name : owner.full_name
  const formatLabel = asset.auction_format
    ? (AUCTION_FORMAT_LABELS[asset.auction_format as AuctionFormat] ?? asset.auction_format)
    : null

  const feeTable: Content[] = fees.length
    ? [
        dataTable(
          t,
          [
            { text: 'Khoản mục' },
            { text: 'Loại', width: 'auto' },
            { text: 'Số tiền', align: 'right', width: 'auto' },
          ],
          fees.map((f): TableCell[] => [
            { text: f.label },
            { text: f.optional ? 'Tuỳ chọn' : 'Bắt buộc' },
            { text: formatVnd(f.amount), alignment: 'right' },
          ]),
        ),
        {
          text: `Tổng chi phí bắt buộc: ${terms.service_fee != null ? formatVnd(terms.service_fee) : BLANK}`,
          bold: true,
          alignment: 'right',
          margin: [0, 4, 0, 0],
        },
      ]
    : [labelRows([['Chi phí dịch vụ', terms.service_fee != null ? formatVnd(terms.service_fee) : BLANK]])]

  const content: Content[] = [
    {
      columns: [
        {
          width: '*',
          alignment: 'center',
          stack: [
            { text: val(org.name).toUpperCase(), bold: true, fontSize: 9 },
            { text: `Số: ${input.contractNo || '……/……/HĐDV'}`, fontSize: 9, margin: [0, 3, 0, 0] },
          ],
        },
        {
          width: '*',
          alignment: 'center',
          stack: [
            { text: 'CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM', bold: true, fontSize: 9 },
            { text: 'Độc lập – Tự do – Hạnh phúc', bold: true, fontSize: 9, decoration: 'underline', margin: [0, 2, 0, 0] },
          ],
        },
      ],
    },
    { text: 'HỢP ĐỒNG DỊCH VỤ ĐẤU GIÁ TÀI SẢN', bold: true, fontSize: 14, alignment: 'center', margin: [0, 22, 0, 2] },
    { text: `(Mã hồ sơ trên sàn: ${input.code ?? '—'})`, fontSize: 8, color: t.muted, alignment: 'center', margin: [0, 0, 0, 12] },
    { stack: LEGAL_BASES.map((b): Content => ({ text: b, italics: true, margin: [0, 0, 0, 2] })) },
    { text: 'Hôm nay, ngày …… tháng …… năm ……, tại ………………………………………, chúng tôi gồm:', margin: [0, 10, 0, 6] },

    { text: 'BÊN A — BÊN CÓ TÀI SẢN', bold: true, margin: [0, 6, 0, 3] },
    labelRows(ownerRows(owner)),
    { text: 'BÊN B — TỔ CHỨC ĐẤU GIÁ TÀI SẢN', bold: true, margin: [0, 8, 0, 3] },
    labelRows(orgRows(org)),
    { text: 'Hai bên thống nhất ký kết hợp đồng dịch vụ đấu giá tài sản với các điều khoản sau:', margin: [0, 10, 0, 0] },

    article(1, 'Tài sản đấu giá', [
      labelRows([
        ['Tên tài sản', val(asset.title)],
        ['Loại tài sản', val(input.categoryLabel)],
        ['Nơi có tài sản', val(joinAddr(asset.address, asset.ward, asset.district, asset.province))],
        ['Đang tranh chấp', legalFlag(asset.has_dispute)],
        ['Đang thế chấp', legalFlag(asset.has_mortgage)],
        ['Bị kê biên', legalFlag(asset.is_seized)],
      ]),
      {
        text: 'Giấy tờ chứng minh quyền sở hữu, quyền được bán tài sản: theo hồ sơ Bên A đã cung cấp và Bên B đã tiếp nhận.',
        margin: [0, 3, 0, 0],
      },
    ]),
    article(2, 'Giá khởi điểm', [
      {
        text:
          startingPrice != null
            ? `Giá khởi điểm của tài sản: ${formatVnd(startingPrice)}.`
            : 'Giá khởi điểm do Bên A quyết định bằng văn bản trên cơ sở kết quả thẩm định giá.',
      },
    ]),
    article(
      3,
      'Hình thức, phương thức và kế hoạch tổ chức đấu giá',
      plan.length
        ? [labelRows(plan.map((r): [string, string] => [r.label, r.value]))]
        : [{ text: `Hình thức đấu giá: ${val(formatLabel)}. Kế hoạch chi tiết do hai bên thống nhất bằng văn bản.` }],
    ),
    article(4, 'Thù lao dịch vụ và chi phí đấu giá', [
      labelRows([
        ['Thù lao dịch vụ', terms.commission_pct != null ? `${terms.commission_pct}% giá trị tài sản bán được` : BLANK],
      ]),
      ...feeTable,
      { text: PAYMENT_TERMS, margin: [0, 5, 0, 0] },
    ]),
    article(5, 'Thời hạn thực hiện', [
      {
        text:
          terms.lead_time_days != null
            ? `Bên B dự kiến tổ chức cuộc đấu giá trong vòng ${terms.lead_time_days} ngày kể từ ngày ký hợp đồng; các mốc chi tiết theo Điều 3.`
            : 'Thời gian tổ chức cuộc đấu giá do hai bên thống nhất bằng văn bản.',
      },
    ]),
    article(6, 'Quyền và nghĩa vụ của Bên A', [{ ul: OWNER_DUTIES }]),
    article(7, 'Quyền và nghĩa vụ của Bên B', [{ ul: ORG_DUTIES }]),
    article(8, 'Chấm dứt hợp đồng và giải quyết tranh chấp', [{ ul: TERMINATION }]),
    article(9, 'Hiệu lực hợp đồng', [{ ul: EFFECT }]),

    {
      unbreakable: true,
      margin: [0, 28, 0, 0],
      columns: [
        {
          width: '*',
          alignment: 'center',
          stack: [
            { text: 'ĐẠI DIỆN BÊN A', bold: true },
            { text: '(Ký, ghi rõ họ tên, đóng dấu nếu có)', italics: true, fontSize: 8, color: t.muted },
            { text: val(ownerSigner), bold: true, margin: [0, 64, 0, 0] },
          ],
        },
        {
          width: '*',
          alignment: 'center',
          stack: [
            { text: 'ĐẠI DIỆN BÊN B', bold: true },
            { text: '(Ký, ghi rõ họ tên, đóng dấu)', italics: true, fontSize: 8, color: t.muted },
            { text: val(org.legal_rep_name), bold: true, margin: [0, 64, 0, 0] },
          ],
        },
      ],
    },
  ]

  return {
    pageSize: 'A4',
    pageMargins: [SIDE_MARGIN, MARGIN, SIDE_MARGIN, 52],
    watermark: { text: 'DỰ THẢO', color: t.line, opacity: 0.3, bold: true },
    defaultStyle: { font: 'Roboto', fontSize: 10, color: t.ink, lineHeight: 1.35 },
    info: { title: `Dự thảo hợp đồng dịch vụ đấu giá — ${asset.title}`, author: org.name ?? undefined },
    content,
    footer: (currentPage: number, pageCount: number) => ({
      margin: [SIDE_MARGIN, 14, SIDE_MARGIN, 0],
      columns: [
        {
          text: `${DRAFT_NOTICE} · ${input.code ?? ''} · Tạo ngày ${fmtDate(input.generatedAt.toISOString())}`,
          fontSize: 7,
          color: t.muted,
        },
        { text: `Trang ${currentPage}/${pageCount}`, width: 'auto', fontSize: 7, color: t.muted, alignment: 'right' },
      ],
    }),
  }
}
