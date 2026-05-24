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
import { ASSET_CATEGORY_LABELS } from './labels'
import { loadGeneralInfo } from '@/lib/general-info/storage'
import { getInfrastructure, createDefaultInfrastructure } from '@/lib/infrastructure/storage'
import { listAuctioneers } from '@/lib/auctioneers/storage'
import { listTaxRecords } from '@/lib/tax/storage'
import { ORG_TYPE_LABELS } from '@/types/general-info'
import { POSITION_LABELS, CONTRACT_TYPE_LABELS } from '@/types/auctioneer'
import { TAX_RECORD_TYPE_LABELS } from '@/types/tax'
import { getTargetYear } from '@/lib/tax/scoring'
import { getCapacityProfile } from '@/lib/applications/storage'

// ---------------------------------------------------------------------------
// Primitive builders
// ---------------------------------------------------------------------------

function h1(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160 } })
}

function h2(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 } })
}

function h3(text: string): Paragraph {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 80 } })
}

function p(text: string, bold = false, indent = false): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: text || '—', bold, size: 24 })],
    spacing: { after: 100 },
    indent: indent ? { left: 360 } : undefined,
  })
}

function paras(text: string): Paragraph[] {
  if (!text || !text.trim()) return [p('—')]
  return text.split('\n').map((line) => p(line))
}

function divider(): Paragraph {
  return new Paragraph({
    border: { bottom: { color: 'CCCCCC', space: 1, style: BorderStyle.SINGLE, size: 4 } },
    spacing: { after: 160 },
  })
}

function infoTable(rows: [string, string][]): Table {
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

function dataTable(headers: string[], rows: string[][]): Table {
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

// ---------------------------------------------------------------------------
// Capacity section children
// ---------------------------------------------------------------------------

function buildCapacityChildren(app: Application): (Paragraph | Table)[] {
  const generalInfo = loadGeneralInfo()
  const infra = getInfrastructure() ?? createDefaultInfrastructure()
  const auctioneers = listAuctioneers().filter((a) => a.isActive)
  const taxRecords = listTaxRecords().filter((r) => !r.isDeleted)
  const { announcement } = app

  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')
  const fmtMoney = (n?: number) =>
    n ? Number(n).toLocaleString('vi-VN') + ' đồng' : '—'
  const yesNo = (b?: boolean) => (b ? 'Có' : 'Không')

  const children: (Paragraph | Table)[] = []

  // ── Cover: asset being auctioned ─────────────────────────────────────────
  children.push(h1('HỒ SƠ NĂNG LỰC TỔ CHỨC ĐẤU GIÁ TÀI SẢN'))
  children.push(p('(Theo Thông tư 19/2024/TT-BTP — Phụ lục I)'))
  children.push(divider())

  children.push(h2('THÔNG TIN TÀI SẢN ĐẤU GIÁ'))
  children.push(
    infoTable([
      ['Loại tài sản', ASSET_CATEGORY_LABELS[announcement.assetCategory as string] ?? announcement.assetCategory ?? ''],
      ['Người có tài sản / Chủ sở hữu', announcement.ownerName],
      ['Mô tả tài sản', announcement.assetDescription],
      ['Giá khởi điểm', fmtMoney(announcement.startingPrice as number)],
      ['Địa chỉ tài sản', announcement.assetLocation],
      ['Tỉnh/thành nơi có tài sản', announcement.province],
      ['Số thông báo', announcement.announcementNumber],
      ['Ngày thông báo', fmtDate(announcement.announcementDate)],
      ['Hạn nộp hồ sơ', fmtDate(announcement.deadline)],
    ])
  )
  children.push(divider())

  // ── Org general info ──────────────────────────────────────────────────────
  if (generalInfo) {
    children.push(h2('THÔNG TIN TỔ CHỨC ĐẤU GIÁ'))
    children.push(
      infoTable([
        ['Tên tổ chức', generalInfo.name],
        ['Tên viết tắt', generalInfo.shortName ?? ''],
        ['Loại tổ chức', ORG_TYPE_LABELS[generalInfo.orgType] ?? generalInfo.orgType],
        ['Mã số thuế', generalInfo.taxCode],
        ['Số ĐKDN', generalInfo.registrationCode ?? ''],
        ['Địa chỉ trụ sở', generalInfo.address],
        ['Phường/xã', generalInfo.ward ?? ''],
        ['Quận/huyện', generalInfo.district ?? ''],
        ['Tỉnh/thành', generalInfo.province],
        ['Điện thoại', generalInfo.phone],
        ['Fax', generalInfo.fax ?? ''],
        ['Email', generalInfo.email],
        ['Website', generalInfo.website ?? ''],
        ['Người đại diện pháp lý', generalInfo.legalRepName],
        ['Chức vụ người đại diện', generalInfo.legalRepPosition ?? ''],
        ['Số CMND/CCCD người đại diện', generalInfo.legalRepIdNumber ?? ''],
        ['Ngày cấp', fmtDate(generalInfo.legalRepIdIssuedDate)],
        ['Nơi cấp', generalInfo.legalRepIdIssuedPlace ?? ''],
        ['Ngày thành lập', fmtDate(generalInfo.foundedDate)],
        ['Số QĐ thành lập', generalInfo.establishmentDecisionNumber ?? ''],
        ['Ngày QĐ thành lập', fmtDate(generalInfo.establishmentDecisionDate)],
        ['Cơ quan cấp QĐ', generalInfo.establishmentDecisionIssuer ?? ''],
        ['Số GP kinh doanh', generalInfo.businessLicenseNumber ?? ''],
        ['Ngày cấp GP', fmtDate(generalInfo.businessLicenseDate)],
        ['Cơ quan cấp GP', generalInfo.businessLicenseIssuer ?? ''],
      ])
    )

    if (generalInfo.bankAccounts?.length > 0) {
      children.push(h3('Tài khoản ngân hàng'))
      children.push(
        dataTable(
          ['Ngân hàng', 'Số tài khoản', 'Chủ tài khoản', 'Chi nhánh', 'Chính'],
          generalInfo.bankAccounts.map((b) => [
            b.bankName,
            b.accountNumber,
            b.accountHolder,
            b.branch ?? '',
            b.isPrimary ? 'Chính' : '',
          ])
        )
      )
    }

    if (generalInfo.branches?.length > 0) {
      children.push(h3('Chi nhánh / Văn phòng đại diện'))
      children.push(
        dataTable(
          ['Tên', 'Loại', 'Địa chỉ', 'Tỉnh/thành', 'Điện thoại', 'Trưởng đơn vị'],
          generalInfo.branches
            .filter((b) => b.isActive)
            .map((b) => [
              b.name,
              b.type === 'BRANCH' ? 'Chi nhánh' : 'Văn phòng đại diện',
              b.address,
              b.province,
              b.phone ?? '',
              b.managerName ?? '',
            ])
        )
      )
    }

    children.push(divider())
  }

  // ── Mục I ─────────────────────────────────────────────────────────────────
  children.push(h2('MỤC I: ĐĂNG KÝ DANH SÁCH BỘ TƯ PHÁP'))
  children.push(
    p(
      generalInfo?.isListedInMOJDirectory
        ? 'Tổ chức đã đăng ký và có mặt trong danh sách tổ chức đấu giá tài sản của Bộ Tư pháp.'
        : 'Tổ chức chưa đăng ký danh sách Bộ Tư pháp.'
    )
  )
  if (generalInfo?.mojListingNotes) {
    children.push(p(generalInfo.mojListingNotes, false, true))
  }
  children.push(divider())

  // ── Mục II ────────────────────────────────────────────────────────────────
  children.push(h2('MỤC II: CƠ SỞ VẬT CHẤT'))

  children.push(h3('II.1. Trụ sở chính và địa điểm tổ chức đấu giá'))
  children.push(
    infoTable([
      ['Địa chỉ', infra.headquarters.address],
      ['Phường/xã', infra.headquarters.ward],
      ['Quận/huyện', infra.headquarters.district],
      ['Tỉnh/thành', infra.headquarters.province],
      ['Điện thoại', infra.headquarters.phone],
      ['Email', infra.headquarters.email],
      ['Diện tích sử dụng (m²)', infra.headquarters.workingArea?.toString() ?? ''],
      ['Số tầng', infra.headquarters.floorCount?.toString() ?? ''],
      ['Hình thức sở hữu', infra.headquarters.isOwned ? 'Sở hữu' : 'Thuê'],
      ...(infra.headquarters.isOwned
        ? []
        : [['Hạn hợp đồng thuê', fmtDate(infra.headquarters.leaseEndDate)] as [string, string]]),
    ])
  )

  children.push(h3('II.1.2. Địa điểm tiếp nhận hồ sơ tham gia đấu giá'))
  children.push(
    infoTable([
      ['Địa điểm', infra.receptionPoint.isAtHeadquarters ? 'Tại trụ sở chính' : infra.receptionPoint.address ?? ''],
      ['Giờ làm việc', infra.receptionPoint.workingHours],
      ['Ngày làm việc', infra.receptionPoint.workingDays?.join(', ') ?? ''],
      ['Hình thức thông báo', infra.receptionPoint.publicNoticeMethod],
    ])
  )

  children.push(h3('II.2. Hệ thống camera'))
  children.push(p('Camera tại văn phòng / nơi lưu hồ sơ:', true))
  children.push(
    infoTable([
      ['Có hệ thống camera', yesNo(infra.cameraAtOffice.hasSystem)],
      ['Vị trí lắp đặt', infra.cameraAtOffice.locations?.join(', ') ?? ''],
      ['Có thể xuất/trích xuất', yesNo(infra.cameraAtOffice.canExtractRecording)],
      ['Lưu trữ kèm hồ sơ', yesNo(infra.cameraAtOffice.canStoreWithCase)],
      ...(infra.cameraAtOffice.technicalNotes
        ? [['Ghi chú kỹ thuật', infra.cameraAtOffice.technicalNotes] as [string, string]]
        : []),
    ])
  )
  children.push(p('Camera tại phòng đấu giá:', true))
  children.push(
    infoTable([
      ['Có hệ thống camera', yesNo(infra.cameraAtAuction.hasSystem)],
      ['Dùng chung với văn phòng', yesNo(infra.cameraAtAuction.isSameAsOffice)],
      ['Vị trí lắp đặt', infra.cameraAtAuction.locations?.join(', ') ?? ''],
      ['Có thể xuất/trích xuất', yesNo(infra.cameraAtAuction.canExtractRecording)],
      ['Lưu trữ kèm hồ sơ', yesNo(infra.cameraAtAuction.canStoreWithCase)],
    ])
  )

  children.push(h3('II.3. Trang thông tin điện tử'))
  children.push(
    infoTable([
      ['Loại trang', infra.website.type === 'OWN_DOMAIN' ? 'Tên miền riêng' : 'Cổng thông tin Bộ Tư pháp'],
      ['Địa chỉ website', infra.website.url],
      ['Cập nhật thường xuyên', yesNo(infra.website.hasRegularUpdates)],
      ['Cập nhật lần cuối', fmtDate(infra.website.lastContentUpdateDate)],
    ])
  )

  children.push(h3('II.4. Cổng đấu giá trực tuyến'))
  const oap = infra.onlineAuctionPlatform
  const oapTypeLabel =
    oap.qualificationType === 'APPROVED'
      ? 'Được phê duyệt'
      : oap.qualificationType === 'CONDUCTED_LAST_YEAR'
      ? 'Đã tổ chức trong năm trước'
      : 'Không có tư cách'
  children.push(
    infoTable([
      ['Tư cách tham gia', oapTypeLabel],
      ...(oap.qualificationType === 'APPROVED'
        ? [
            ['Số văn bản phê duyệt', oap.approvalDocumentNumber ?? ''] as [string, string],
            ['Ngày phê duyệt', fmtDate(oap.approvalDate)] as [string, string],
            ['Cơ quan phê duyệt', oap.approvedBy ?? ''] as [string, string],
          ]
        : []),
      ['URL cổng đấu giá', oap.url ?? ''],
      ['Nền tảng', oap.isOwnPlatform ? 'Tự vận hành' : oap.platformProvider ?? ''],
      ...(oap.qualificationType === 'CONDUCTED_LAST_YEAR'
        ? [['Số cuộc trực tuyến năm trước', (oap.lastYearOnlineAuctionCount ?? 0).toString()] as [string, string]]
        : []),
    ])
  )

  children.push(h3('II.5. Kho lưu trữ hồ sơ'))
  const storageLabels: Record<string, string> = {
    CABINET: 'Tủ hồ sơ',
    ROOM: 'Phòng lưu trữ riêng',
    WAREHOUSE: 'Kho chuyên dụng',
    DIGITAL: 'Lưu trữ số',
    HYBRID: 'Kết hợp số và vật lý',
  }
  children.push(
    infoTable([
      ['Địa điểm', infra.archive.isAtHeadquarters ? 'Tại trụ sở chính' : infra.archive.address ?? ''],
      ['Diện tích (m²)', infra.archive.area?.toString() ?? ''],
      ['Hình thức lưu trữ', storageLabels[infra.archive.storageType] ?? infra.archive.storageType],
      ['Biện pháp bảo mật', infra.archive.securityMeasures?.join(', ') ?? ''],
    ])
  )
  children.push(divider())

  // ── Mục IV ────────────────────────────────────────────────────────────────
  children.push(h2('MỤC IV: KINH NGHIỆM VÀ NĂNG LỰC'))

  const profile = getCapacityProfile()

  children.push(h3('IV.1-4. Lịch sử tổ chức đấu giá tài sản'))
  children.push(
    infoTable([
      ['Số cuộc đấu giá đã hoàn thành (có kết quả)', profile.auctionsCompleted.toString()],
      ['Trong đó số cuộc chưa có giá trúng', profile.auctionsMissingPrice.toString()],
      ['Số cuộc có giá trúng đầy đủ', (profile.auctionsCompleted - profile.auctionsMissingPrice).toString()],
    ])
  )

  children.push(h3('IV.5. Thời gian hoạt động'))
  if (generalInfo?.foundedDate) {
    const founded = new Date(generalInfo.foundedDate)
    const now = new Date()
    const years = Math.floor((now.getTime() - founded.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    children.push(
      infoTable([
        ['Ngày thành lập', fmtDate(generalInfo.foundedDate)],
        ['Số năm hoạt động', `${years} năm`],
      ])
    )
  } else {
    children.push(p('Chưa khai báo ngày thành lập.'))
  }

  children.push(h3(`IV.6-8. Đội ngũ đấu giá viên (${auctioneers.length} người)`))
  if (auctioneers.length > 0) {
    children.push(
      dataTable(
        ['STT', 'Họ và tên', 'Số thẻ ĐGV', 'Ngày cấp thẻ', 'Vị trí', 'Loại HĐ', 'Ngày bắt đầu'],
        auctioneers.map((a, i) => [
          (i + 1).toString(),
          a.fullName,
          a.licenseNumber,
          fmtDate(a.licenseIssuedDate),
          POSITION_LABELS[a.position] ?? a.position,
          CONTRACT_TYPE_LABELS[a.contractType] ?? a.contractType,
          fmtDate(a.joinedDate),
        ])
      )
    )
  } else {
    children.push(p('Chưa có dữ liệu đấu giá viên.'))
  }

  children.push(h3('IV.9. Khoản nộp thuế / ngân sách nhà nước năm trước'))
  const targetYear = getTargetYear()
  const targetTax = taxRecords.find((r) => r.year === targetYear && !r.isDeleted)
  if (targetTax) {
    children.push(
      infoTable([
        ['Năm tài chính', targetTax.year.toString()],
        ['Loại kê khai', TAX_RECORD_TYPE_LABELS[targetTax.recordType]],
        ['Số tiền đã nộp (không bao gồm VAT)', fmtMoney(targetTax.amount)],
        ['Đã quyết toán', yesNo(targetTax.isFinalized)],
        ['Ngày quyết toán', fmtDate(targetTax.finalizedDate)],
        ...(targetTax.notes ? [['Ghi chú', targetTax.notes] as [string, string]] : []),
      ])
    )
  } else {
    const anyRecord = taxRecords.find((r) => !r.isDeleted)
    if (anyRecord) {
      children.push(
        infoTable([
          ['Năm tài chính', anyRecord.year.toString()],
          ['Loại kê khai', TAX_RECORD_TYPE_LABELS[anyRecord.recordType]],
          ['Số tiền đã nộp (không bao gồm VAT)', fmtMoney(anyRecord.amount)],
          ['Đã quyết toán', yesNo(anyRecord.isFinalized)],
        ])
      )
    } else {
      children.push(p('Chưa có dữ liệu kê khai thuế.'))
    }
  }

  return children
}

// ---------------------------------------------------------------------------
// Auction plan section children
// ---------------------------------------------------------------------------

function buildAuctionPlanChildren(app: Application): (Paragraph | Table)[] {
  const p_ = app.auctionPlan
  const v = app.sectionVCriteria
  const { announcement } = app

  const children: (Paragraph | Table)[] = []

  children.push(h1('PHƯƠNG ÁN ĐẤU GIÁ TÀI SẢN'))
  children.push(p(`Tài sản: ${announcement.assetDescription || '—'}`))
  children.push(p(`Người có tài sản: ${announcement.ownerName || '—'}`))
  children.push(p(`Hạn nộp hồ sơ: ${announcement.deadline ? new Date(announcement.deadline).toLocaleDateString('vi-VN') : '—'}`))
  children.push(divider())

  children.push(h2('MỤC III: PHƯƠNG ÁN ĐẤU GIÁ (16 ĐIỂM)'))

  children.push(h3('III.1. Hình thức đấu giá, bước giá, số vòng đấu giá (8 điểm)'))
  children.push(...paras(p_.format))

  children.push(divider())

  children.push(h3('III.2. Phương án bán, tiếp nhận hồ sơ tham gia đấu giá (2 điểm)'))
  children.push(...paras(p_.receptionPlan))

  children.push(divider())

  children.push(h3('III.3. Đối tượng, điều kiện tham gia đấu giá (3 điểm)'))
  children.push(...paras(p_.participantConditions))

  children.push(divider())

  children.push(h3('III.4. Giải pháp giám sát, chống thông đồng, dìm giá (3 điểm)'))
  children.push(...paras(p_.antiCollusionMeasures))

  if (v.length > 0) {
    children.push(divider())
    children.push(h2('MỤC V: TIÊU CHÍ KHÁC (tối đa 8 điểm)'))

    const natureLabel = (n: string) => (n === 'CAPACITY' ? 'Năng lực' : n === 'PROPOSAL' ? 'Phương án' : n)
    const meetsLabel = (m: boolean | null) =>
      m === true ? 'Đáp ứng' : m === false ? 'Không đáp ứng' : 'Chưa xác định'

    children.push(
      dataTable(
        ['STT', 'Tiêu chí', 'Phân loại', 'Điểm', 'Đáp ứng', 'Bằng chứng / Căn cứ'],
        v.map((c, i) => [
          (i + 1).toString(),
          c.label,
          natureLabel(c.nature),
          c.maxPoints.toString(),
          meetsLabel(c.meets),
          c.evidence,
        ])
      )
    )
  }

  return children
}

// ---------------------------------------------------------------------------
// Document builders
// ---------------------------------------------------------------------------

function buildCapacityDoc(app: Application): Document {
  return new Document({ sections: [{ children: buildCapacityChildren(app) }] })
}

function buildAuctionPlanDoc(app: Application): Document {
  return new Document({ sections: [{ children: buildAuctionPlanChildren(app) }] })
}

function buildIntegratedDoc(app: Application): Document {
  return new Document({
    sections: [
      { children: buildCapacityChildren(app) },
      { children: buildAuctionPlanChildren(app) },
    ],
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateExport(
  app: Application,
  _profile: unknown,
  format: ExportFormat
): Promise<void> {
  const safeTitle = (app.announcement.ownerName || 'HoSo').replace(/[^a-zA-Z0-9À-ỹ\s]/g, '').trim().slice(0, 30)
  const dateStr = new Date().toISOString().slice(0, 10)

  if (format === 'SEPARATED') {
    const zip = new JSZip()
    const capDoc = buildCapacityDoc(app)
    const planDoc = buildAuctionPlanDoc(app)
    const [capBuffer, planBuffer] = await Promise.all([Packer.toBlob(capDoc), Packer.toBlob(planDoc)])
    zip.file('01_Ho-so-nang-luc.docx', capBuffer)
    zip.file('02_Phuong-an-dau-gia.docx', planBuffer)
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    saveAs(zipBlob, `HoSo-${safeTitle}-${dateStr}.zip`)
  } else {
    const doc = buildIntegratedDoc(app)
    const blob = await Packer.toBlob(doc)
    saveAs(blob, `HoSo-Tich-hop-${safeTitle}-${dateStr}.docx`)
  }
}
