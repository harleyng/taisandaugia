// Mô hình nội dung hồ sơ đấu giá viên — TRUNG LẬP về định dạng.
//
// DOCX (export-dossier.ts) và PDF (export-dossier-pdf.ts) đều render từ đây,
// nên hai định dạng không bao giờ lệch nhau khi thêm/bớt trường.
//
// NGUỒN DỮ LIỆU: hồ sơ nhân sự KHÔNG tự tạo dữ liệu. Thông tin người lấy từ
// module Đấu giá viên, cuộc đấu giá lấy từ module Lịch sử đấu giá — cả hai
// đều thuộc Hồ sơ năng lực.

import type { Auctioneer } from '@/types/auctioneer'
import { POSITION_LABELS, CONTRACT_TYPE_LABELS, computePracticeYears } from '@/types/auctioneer'
import type { CpdExemption, DossierEvent, PersonnelDocument } from '@/types/personnel'
import { DOC_TYPE_LABELS, GENDER_LABELS, ID_TYPE_LABELS } from '@/types/personnel'
import type { CpdCatalog } from '@/types/cpd-catalog'
import { EMPTY_CPD_CATALOG } from '@/types/cpd-catalog'
import {
  creditedHoursOf, formLabel, indexCatalog, makeCpdResolver,
} from './cpd-catalog'
import { groupNumber } from '@/components/asset-posting/format'
import { trainingCompliance } from './completeness'
import { progressHours } from './cpd'
import {
  auctionStats, notableAuctions, categoryLabel, type ConductedAuction,
} from './auction-source'

// Chỉ có MỘT mẫu. Cột `template` trong personnel_dossier_exports vẫn giữ lại
// để sau này thêm mẫu mới không phải đổi schema.
export type DossierTemplate = 'FULL'

export const TEMPLATE_LABELS: Record<DossierTemplate, string> = {
  FULL: 'Hồ sơ đấu giá viên đầy đủ',
}

export const TEMPLATE_DESCRIPTIONS: Record<DossierTemplate, string> = {
  FULL: 'Định danh, giấy tờ hành nghề, quá trình công tác, tổng quan kinh nghiệm đấu giá, đào tạo và khen thưởng.',
}

export const TEMPLATE_ORDER: DossierTemplate[] = ['FULL']

export interface DossierBundle {
  person: Auctioneer
  documents: PersonnelDocument[]
  events: DossierEvent[]
  /**
   * Cuộc đấu giá đã điều hành — TRUYỀN VÀO, không tự lấy.
   * Nguồn nay là Supabase (org_auction_records) nên phải fetch bất đồng bộ
   * trước; builder giữ nguyên đồng bộ để hai renderer DOCX/PDF dùng chung.
   */
  auctions: ConductedAuction[]
  /** Diện miễn bồi dưỡng (Điều 26.3) — thiếu thì mục VII kết luận sai. */
  cpdExemptions?: CpdExemption[]
  /**
   * Danh mục bồi dưỡng — TRUYỀN VÀO, không tự fetch. Builder phải giữ ĐỒNG BỘ
   * để hai renderer dùng chung; thiếu danh mục thì mục VI mất tên hình thức và
   * mục VII chấm sai (mọi thứ tụt về "chưa đủ giờ").
   */
  cpdCatalog?: CpdCatalog
}

export type DossierBlock =
  | { kind: 'info'; heading: string; rows: [string, string][] }
  | { kind: 'table'; heading: string; headers: string[]; rows: string[][] }
  | { kind: 'empty'; heading: string; text: string }

export interface DossierContent {
  title: string
  orgName: string
  personName: string
  blocks: DossierBlock[]
  footer: string
}

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')
const fmtMoney = (n?: number) => (n ? `${groupNumber(String(n))} ₫` : '—')

function expiryStatus(expiry?: string): string {
  if (!expiry) return 'Không thời hạn'
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return 'Đã hết hạn'
  if (days < 60) return `Sắp hết hạn (còn ${days} ngày)`
  return 'Còn hiệu lực'
}

function tableOrEmpty(
  heading: string,
  headers: string[],
  rows: string[][],
  emptyText: string,
): DossierBlock {
  return rows.length > 0
    ? { kind: 'table', heading, headers, rows }
    : { kind: 'empty', heading, text: emptyText }
}

/** Khối định danh đầy đủ — chỉ dùng cho template FULL (có CCCD). */
function identityBlock(person: Auctioneer): DossierBlock {
  return {
    kind: 'info',
    heading: 'I. Thông tin cá nhân',
    rows: [
      ['Họ và tên', person.fullName],
      ['Ngày sinh', fmtDate(person.dateOfBirth)],
      ['Giới tính', person.gender ? GENDER_LABELS[person.gender] : '—'],
      ['Quê quán', person.hometown ?? '—'],
      ['Dân tộc', person.ethnicity ?? '—'],
      ['Quốc tịch', person.nationality ?? '—'],
      ['Địa chỉ thường trú', person.permanentAddress ?? '—'],
      [person.idType ? ID_TYPE_LABELS[person.idType] : 'Số giấy tờ', person.idNumber ?? '—'],
      ['Ngày cấp', fmtDate(person.idIssuedDate)],
      ['Nơi cấp', person.idIssuedPlace ?? '—'],
      ['Trình độ học vấn', person.educationLevel ?? '—'],
      ['Chuyên ngành', person.major ?? '—'],
      ['Cơ sở đào tạo', person.almaMater ?? '—'],
      ['Chức vụ', POSITION_LABELS[person.position]],
      ['Loại hợp đồng', CONTRACT_TYPE_LABELS[person.contractType]],
      ['Số thẻ đấu giá viên', person.licenseNumber],
      ['Ngày cấp thẻ', fmtDate(person.licenseIssuedDate)],
      ['Ngày hết hạn thẻ', fmtDate(person.licenseExpiryDate)],
      ['Số CCHN', person.professionalCertNumber || '—'],
      ['Ngày cấp CCHN', fmtDate(person.professionalCertIssuedDate)],
      ['Ngày bắt đầu hành nghề đấu giá', fmtDate(person.practiceStartDate ?? person.licenseIssuedDate)],
      ['Ngày bắt đầu giữ chức quản lý', fmtDate(person.managementStartDate)],
      ['Ngày bắt đầu công tác tại tổ chức', fmtDate(person.joinedDate)],
      ['Số năm hành nghề', `${computePracticeYears(person)} năm`],
      ['Email', person.email ?? '—'],
      ['Điện thoại', person.phone ?? '—'],
    ],
  }
}

export function buildDossierContent(b: DossierBundle, orgName: string): DossierContent {
  const {
    person, documents, events, auctions, cpdExemptions = [],
    cpdCatalog = EMPTY_CPD_CATALOG,
  } = b

  const stats = auctionStats(auctions)
  const notable = notableAuctions(auctions)

  const cpdIndex = indexCatalog(cpdCatalog)
  const resolveCpd = makeCpdResolver(cpdCatalog)
  const cpdLabel = (e: DossierEvent) => formLabel(
    e.cpdActivityTypeId ? cpdIndex.typeById.get(e.cpdActivityTypeId) : undefined,
    e.cpdActivityRoleId ? cpdIndex.roleById.get(e.cpdActivityRoleId) : undefined,
  )

  const work = events.filter((e) => e.eventType === 'WORK')
  const training = events.filter((e) => e.eventType === 'TRAINING')
  const rewards = events.filter((e) => e.eventType === 'REWARD' || e.eventType === 'DISCIPLINE')
  const cpdYear = new Date().getFullYear()
  const cpdExemption = cpdExemptions.find((x) => x.year === cpdYear)
  const cpdExemptName = cpdExemption
    ? cpdIndex.reasonById.get(cpdExemption.reasonId)?.name
    : undefined
  const training_ = trainingCompliance(
    events,
    cpdYear,
    resolveCpd,
    cpdExemption ? { reasonName: cpdExemptName } : undefined,
    cpdLabel,
  )

  const blocks: DossierBlock[] = [
    identityBlock(person),

    tableOrEmpty(
      'II. Giấy tờ hành nghề',
      ['Loại giấy tờ', 'Số hiệu', 'Nơi cấp', 'Ngày cấp', 'Hết hạn', 'Trạng thái'],
      documents.map((d) => [
        DOC_TYPE_LABELS[d.docType],
        d.docNumber ?? '',
        d.issuer ?? '',
        fmtDate(d.issuedDate),
        fmtDate(d.expiryDate),
        expiryStatus(d.expiryDate),
      ]),
      'Chưa khai báo giấy tờ hành nghề.',
    ),

    tableOrEmpty(
      'III. Quá trình công tác',
      ['Từ ngày', 'Đến ngày', 'Nơi công tác', 'Chức vụ', 'Trung tâm DVĐG (Sở Tư pháp)'],
      work.map((e) => [
        fmtDate(e.startedOn),
        e.endedOn ? fmtDate(e.endedOn) : 'Nay',
        e.organizationName ?? '',
        e.role ?? e.title,
        e.isStateAuctionCenter ? 'Có' : '',
      ]),
      'Chưa khai báo quá trình công tác.',
    ),

    // Tổng quan TRƯỚC, danh sách chi tiết SAU: người đọc hồ sơ dự tuyển cần
    // thấy ngay tầm vóc kinh nghiệm, không phải tự cộng từ một bảng dài.
    {
      kind: 'info',
      heading: 'IV. Tổng quan kinh nghiệm đấu giá',
      rows: [
        ['Số cuộc đã tổ chức', `${stats.total} cuộc`],
        [
          'Số cuộc đấu giá thành',
          stats.total > 0
            ? `${stats.successful} cuộc (${Math.round((stats.successful / stats.total) * 100)}%)`
            : '—',
        ],
        [
          'Trung bình chênh lệch so với giá khởi điểm',
          stats.avgDiffPercent === null
            ? '—'
            : `${stats.avgDiffPercent >= 0 ? '+' : ''}${stats.avgDiffPercent.toFixed(1)}%` +
              (stats.avgDiffAmount ? ` (${fmtMoney(Math.round(stats.avgDiffAmount))})` : ''),
        ],
        ['Tổng giá trị trúng đấu giá', fmtMoney(stats.totalWinningValue)],
        [
          'Danh mục tài sản thường phụ trách',
          stats.topCategories.length
            ? stats.topCategories.map((c) => `${c.label} (${c.count})`).join(' · ')
            : '—',
        ],
      ],
    },

    tableOrEmpty(
      `V. Cuộc đấu giá tiêu biểu (chênh lệch cao nhất)`,
      ['Ngày', 'Tài sản', 'Danh mục', 'Giá khởi điểm', 'Giá trúng', 'Chênh lệch'],
      notable.map((a) => [
        fmtDate(a.date),
        a.assetDescription,
        categoryLabel(a.assetCategory),
        fmtMoney(a.startingPrice),
        fmtMoney(a.winningPrice),
        a.priceDiff
          ? `${fmtMoney(a.priceDiff)} (+${(a.priceDiffPercent ?? 0).toFixed(1)}%)`
          : '—',
      ]),
      'Chưa có cuộc đấu giá nào có chênh lệch so với giá khởi điểm.',
    ),

    tableOrEmpty(
      'VI. Bồi dưỡng nghiệp vụ',
      ['Năm', 'Ngày', 'Hình thức', 'Nội dung', 'Đơn vị tổ chức', 'Số giờ', 'Xếp loại'],
      training.map((e) => [
        e.cpdYear ? String(e.cpdYear) : '',
        fmtDate(e.startedOn),
        cpdLabel(e),
        e.title,
        e.organizationName ?? '',
        // Số giờ ĐƯỢC TÍNH. Hoạt động cho đạt cả năm để trống — in số giờ ở đó
        // sẽ trông như đang cộng dồn vào mốc 8 giờ.
        (() => { const r = resolveCpd(e); return r?.mode === 'HOURS' ? String(creditedHoursOf(e, r)) : '' })(),
        e.outcome ?? '',
      ]),
      'Chưa ghi nhận khoá bồi dưỡng nào.',
    ),

    {
      kind: 'info',
      heading: 'VII. Tuân thủ bồi dưỡng bắt buộc',
      // Nêu rõ CĂN CỨ chứ không chỉ con số giờ: người được miễn hoặc đạt qua
      // hình thức thay thế (Điều 26.2, 26.3) vẫn là tuân thủ, in "thiếu giờ"
      // cho họ là sai luật.
      rows: [
        [
          'Căn cứ pháp lý',
          'Điều 26 Thông tư 19/2024/TT-BTP — tối thiểu 8 giờ/năm',
        ],
        [
          `Kết luận năm ${training_.year}`,
          training_.isExempt
            ? `Được miễn — ${cpdExemptName ?? 'không rõ lý do'}`
            : `${progressHours(training_)}/${training_.required} giờ` +
              (training_.ok
                ? ' — Đạt'
                : ` — CÒN THIẾU ${training_.required - training_.hours} giờ`),
        ],
        ...(training_.missingProof
          ? [['Lưu ý', 'Có hoạt động chưa đính kèm giấy tờ xác nhận theo Điều 27.1.'] as [string, string]]
          : []),
      ],
    },

    tableOrEmpty(
      'VIII. Khen thưởng / Kỷ luật',
      ['Ngày', 'Loại', 'Nội dung', 'Cấp quyết định', 'Số quyết định'],
      rewards.map((e) => [
        fmtDate(e.startedOn),
        e.eventType === 'REWARD' ? 'Khen thưởng' : 'Kỷ luật',
        e.title,
        e.organizationName ?? '',
        e.referenceNo ?? '',
      ]),
      'Không có.',
    ),
  ]

  return {
    title: 'HỒ SƠ ĐẤU GIÁ VIÊN',
    orgName,
    personName: person.fullName,
    blocks,
    footer: `Xuất ngày ${new Date().toLocaleString('vi-VN')}`,
  }
}

export function safeFileName(s: string): string {
  return s.replace(/[^a-zA-Z0-9À-ỹ\s]/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'HoSo'
}
