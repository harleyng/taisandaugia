import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Application, ExportFormat } from '@/types/application'
import { CapacityProfile } from '@/types/capacity-profile'
import { ASSET_CATEGORY_LABELS } from '@/lib/applications/labels'
import { useGeneralInfo } from '@/hooks/useGeneralInfo'
import { useInfrastructure } from '@/hooks/useInfrastructure'
import { useAuctioneers } from '@/hooks/useAuctioneers'
import { useTaxRecords } from '@/hooks/useTaxRecords'
import { ORG_TYPE_LABELS } from '@/types/general-info'
import { POSITION_LABELS, CONTRACT_TYPE_LABELS } from '@/types/auctioneer'
import { TAX_RECORD_TYPE_LABELS } from '@/types/tax'
import { getTargetYear } from '@/lib/tax/scoring'
import { useMemo } from 'react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  format: ExportFormat
  app: Application
  profile: CapacityProfile
}

export function PreviewModal({ open, onOpenChange, format, app }: Props) {
  // Dùng lại chính các hook của từng module thay vì đọc thẳng repo: chúng đã có
  // React Query nên dữ liệu được chia sẻ cache với các trang khác, không nạp lại.
  const { generalInfo } = useGeneralInfo()
  const { infra } = useInfrastructure()
  const { auctioneers: allAuctioneers } = useAuctioneers()
  const auctioneers = useMemo(() => allAuctioneers.filter((a) => a.isActive), [allAuctioneers])
  // useTaxRecords đã lọc bản ghi đã xoá mềm.
  const { records: taxRecords } = useTaxRecords()

  const { announcement, auctionPlan, sectionVCriteria } = app

  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')
  const fmtMoney = (n?: number | string) => (n ? Number(n).toLocaleString('vi-VN') + ' đồng' : '—')
  const yesNo = (b?: boolean) => (b ? 'Có' : 'Không')

  const targetYear = getTargetYear()
  const targetTax = taxRecords.find((r) => r.year === targetYear)
  const anyTax = targetTax ?? taxRecords[0]

  const storageLabels: Record<string, string> = {
    CABINET: 'Tủ hồ sơ',
    ROOM: 'Phòng lưu trữ riêng',
    WAREHOUSE: 'Kho chuyên dụng',
    DIGITAL: 'Lưu trữ số',
    HYBRID: 'Kết hợp',
  }

  const oapTypeLabel =
    infra.onlineAuctionPlatform.qualificationType === 'APPROVED'
      ? 'Được phê duyệt'
      : infra.onlineAuctionPlatform.qualificationType === 'CONDUCTED_LAST_YEAR'
      ? 'Đã tổ chức trong năm trước'
      : 'Không có tư cách'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Preview nội dung hồ sơ dự tuyển</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {format === 'SEPARATED' ? 'Tách rời — 2 file' : 'Tích hợp — 1 file'}
          </p>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-6 text-sm text-foreground pb-4">

            {/* ── FILE 1: Hồ sơ năng lực ── */}
            <DocFile label={format === 'SEPARATED' ? '01_Ho-so-nang-luc.docx' : undefined}>

              <DocH1>HỒ SƠ NĂNG LỰC TỔ CHỨC ĐẤU GIÁ TÀI SẢN</DocH1>
              <DocMuted>Theo Thông tư 19/2024/TT-BTP — Phụ lục I</DocMuted>

              <DocH2>THÔNG TIN TÀI SẢN ĐẤU GIÁ</DocH2>
              <InfoTable rows={[
                ['Loại tài sản', ASSET_CATEGORY_LABELS[announcement.assetCategory as string] ?? announcement.assetCategory],
                ['Người có tài sản', announcement.ownerName],
                ['Mô tả tài sản', announcement.assetDescription],
                ['Giá khởi điểm', fmtMoney(announcement.startingPrice as number)],
                ['Địa chỉ tài sản', announcement.assetLocation],
                ['Tỉnh/thành', announcement.province],
                ['Số thông báo', announcement.announcementNumber],
                ['Ngày thông báo', fmtDate(announcement.announcementDate)],
                ['Hạn nộp hồ sơ', fmtDate(announcement.deadline)],
              ]} />

              {generalInfo && (
                <>
                  <DocH2>THÔNG TIN TỔ CHỨC ĐẤU GIÁ</DocH2>
                  <InfoTable rows={[
                    ['Tên tổ chức', generalInfo.name],
                    ['Tên viết tắt', generalInfo.shortName ?? ''],
                    ['Loại tổ chức', ORG_TYPE_LABELS[generalInfo.orgType] ?? generalInfo.orgType],
                    ['Mã số thuế', generalInfo.taxCode],
                    ['Địa chỉ trụ sở', `${generalInfo.address}, ${generalInfo.ward ?? ''}, ${generalInfo.district ?? ''}, ${generalInfo.province}`],
                    ['Điện thoại', generalInfo.phone],
                    ['Email', generalInfo.email],
                    ['Người đại diện pháp lý', `${generalInfo.legalRepName}${generalInfo.legalRepPosition ? ` — ${generalInfo.legalRepPosition}` : ''}`],
                    ['CMND/CCCD người đại diện', generalInfo.legalRepIdNumber ?? ''],
                    ['Ngày thành lập', fmtDate(generalInfo.foundedDate)],
                    ['Số QĐ / GP kinh doanh', generalInfo.establishmentDecisionNumber ?? generalInfo.businessLicenseNumber ?? ''],
                  ]} />

                  {generalInfo.bankAccounts?.length > 0 && (
                    <>
                      <DocH3>Tài khoản ngân hàng</DocH3>
                      <DataTable
                        headers={['Ngân hàng', 'Số TK', 'Chủ TK', 'Chi nhánh']}
                        rows={generalInfo.bankAccounts.map((b) => [b.bankName, b.accountNumber, b.accountHolder, b.branch ?? ''])}
                      />
                    </>
                  )}
                </>
              )}

              <DocH2>MỤC I: ĐĂNG KÝ DANH SÁCH BỘ TƯ PHÁP</DocH2>
              <DocP>
                {generalInfo?.isListedInMOJDirectory
                  ? 'Tổ chức đã đăng ký và có mặt trong danh sách tổ chức đấu giá tài sản của Bộ Tư pháp.'
                  : 'Tổ chức chưa đăng ký danh sách Bộ Tư pháp.'}
              </DocP>

              <DocH2>MỤC II: CƠ SỞ VẬT CHẤT</DocH2>

              <DocH3>II.1. Trụ sở chính và địa điểm tổ chức đấu giá</DocH3>
              <InfoTable rows={[
                ['Địa chỉ', `${infra.headquarters.address}, ${infra.headquarters.ward}, ${infra.headquarters.district}, ${infra.headquarters.province}`],
                ['Điện thoại', infra.headquarters.phone],
                ['Email', infra.headquarters.email],
                ['Diện tích sử dụng (m²)', infra.headquarters.workingArea?.toString() ?? ''],
                ['Số tầng', infra.headquarters.floorCount?.toString() ?? ''],
                ['Hình thức sở hữu', infra.headquarters.isOwned ? 'Sở hữu' : 'Thuê'],
                ...(!infra.headquarters.isOwned
                  ? [['Hạn hợp đồng thuê', fmtDate(infra.headquarters.leaseEndDate)] as [string, string]]
                  : []),
              ]} />

              <DocH3>II.1.2. Điểm tiếp nhận hồ sơ tham gia đấu giá</DocH3>
              <InfoTable rows={[
                ['Địa điểm', infra.receptionPoint.isAtHeadquarters ? 'Tại trụ sở chính' : infra.receptionPoint.address ?? ''],
                ['Giờ làm việc', infra.receptionPoint.workingHours],
                ['Ngày làm việc trong tuần', infra.receptionPoint.workingDays?.join(', ') ?? ''],
                ['Hình thức thông báo', infra.receptionPoint.publicNoticeMethod],
              ]} />

              <DocH3>II.2. Hệ thống camera</DocH3>
              <DocP><strong>Camera tại văn phòng:</strong> {yesNo(infra.cameraAtOffice.hasSystem)}</DocP>
              {infra.cameraAtOffice.hasSystem && (
                <InfoTable rows={[
                  ['Vị trí lắp đặt', infra.cameraAtOffice.locations?.join(', ') ?? ''],
                  ['Có thể xuất/trích xuất', yesNo(infra.cameraAtOffice.canExtractRecording)],
                  ['Lưu trữ kèm hồ sơ vụ việc', yesNo(infra.cameraAtOffice.canStoreWithCase)],
                ]} />
              )}
              <DocP><strong>Camera tại phòng đấu giá:</strong> {yesNo(infra.cameraAtAuction.hasSystem)}</DocP>
              {infra.cameraAtAuction.hasSystem && (
                <InfoTable rows={[
                  ['Dùng chung với văn phòng', yesNo(infra.cameraAtAuction.isSameAsOffice)],
                  ['Vị trí lắp đặt', infra.cameraAtAuction.locations?.join(', ') ?? ''],
                  ['Có thể xuất/trích xuất', yesNo(infra.cameraAtAuction.canExtractRecording)],
                  ['Lưu trữ kèm hồ sơ vụ việc', yesNo(infra.cameraAtAuction.canStoreWithCase)],
                ]} />
              )}

              <DocH3>II.3. Trang thông tin điện tử</DocH3>
              <InfoTable rows={[
                ['Loại trang', infra.website.type === 'OWN_DOMAIN' ? 'Tên miền riêng' : 'Cổng thông tin Bộ Tư pháp'],
                ['Địa chỉ website', infra.website.url],
                ['Cập nhật thường xuyên', yesNo(infra.website.hasRegularUpdates)],
                ['Cập nhật lần cuối', fmtDate(infra.website.lastContentUpdateDate)],
              ]} />

              <DocH3>II.4. Cổng đấu giá trực tuyến</DocH3>
              <InfoTable rows={[
                ['Tư cách tham gia', oapTypeLabel],
                ...(infra.onlineAuctionPlatform.qualificationType === 'APPROVED'
                  ? [
                      ['Số văn bản phê duyệt', infra.onlineAuctionPlatform.approvalDocumentNumber ?? ''] as [string, string],
                      ['Ngày phê duyệt', fmtDate(infra.onlineAuctionPlatform.approvalDate)] as [string, string],
                      ['Cơ quan phê duyệt', infra.onlineAuctionPlatform.approvedBy ?? ''] as [string, string],
                    ]
                  : []),
                ['URL cổng đấu giá', infra.onlineAuctionPlatform.url ?? ''],
                ['Nền tảng', infra.onlineAuctionPlatform.isOwnPlatform ? 'Tự vận hành' : infra.onlineAuctionPlatform.platformProvider ?? ''],
                ...(infra.onlineAuctionPlatform.qualificationType === 'CONDUCTED_LAST_YEAR'
                  ? [['Số cuộc trực tuyến năm trước', (infra.onlineAuctionPlatform.lastYearOnlineAuctionCount ?? 0).toString()] as [string, string]]
                  : []),
              ]} />

              <DocH3>II.5. Kho lưu trữ hồ sơ</DocH3>
              <InfoTable rows={[
                ['Địa điểm', infra.archive.isAtHeadquarters ? 'Tại trụ sở chính' : infra.archive.address ?? ''],
                ['Diện tích (m²)', infra.archive.area?.toString() ?? ''],
                ['Hình thức lưu trữ', storageLabels[infra.archive.storageType] ?? infra.archive.storageType],
                ['Biện pháp bảo mật', infra.archive.securityMeasures?.join(', ') ?? ''],
              ]} />

              <DocH2>MỤC IV: KINH NGHIỆM VÀ NĂNG LỰC</DocH2>

              <DocH3>IV.1-4. Lịch sử tổ chức đấu giá tài sản</DocH3>
              <InfoTable rows={[
                ['Số cuộc đấu giá đã hoàn thành', app.capacitySnapshot.scoreIV1to4 > 0 ? `${app.capacitySnapshot.scoreIV1to4} điểm được ghi nhận` : 'Chưa khai báo'],
              ]} />

              <DocH3>IV.5. Thời gian hoạt động</DocH3>
              {generalInfo?.foundedDate ? (() => {
                const years = Math.floor((Date.now() - new Date(generalInfo.foundedDate).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                return (
                  <InfoTable rows={[
                    ['Ngày thành lập', fmtDate(generalInfo.foundedDate)],
                    ['Số năm hoạt động', `${years} năm`],
                  ]} />
                )
              })() : <DocP><em className="text-muted-foreground">Chưa khai báo ngày thành lập.</em></DocP>}

              <DocH3>{`IV.6-8. Đội ngũ đấu giá viên (${auctioneers.length} người)`}</DocH3>
              {auctioneers.length > 0 ? (
                <DataTable
                  headers={['STT', 'Họ và tên', 'Số thẻ ĐGV', 'Ngày cấp thẻ', 'Vị trí', 'Loại HĐ', 'Bắt đầu']}
                  rows={auctioneers.map((a, i) => [
                    (i + 1).toString(),
                    a.fullName,
                    a.licenseNumber,
                    fmtDate(a.licenseIssuedDate),
                    POSITION_LABELS[a.position] ?? a.position,
                    CONTRACT_TYPE_LABELS[a.contractType] ?? a.contractType,
                    fmtDate(a.joinedDate),
                  ])}
                />
              ) : (
                <DocP><em className="text-muted-foreground">Chưa có dữ liệu đấu giá viên.</em></DocP>
              )}

              <DocH3>IV.9. Khoản nộp thuế / ngân sách nhà nước năm trước</DocH3>
              {anyTax ? (
                <InfoTable rows={[
                  ['Năm tài chính', anyTax.year.toString()],
                  ['Loại kê khai', TAX_RECORD_TYPE_LABELS[anyTax.recordType]],
                  ['Số tiền đã nộp (không gồm VAT)', fmtMoney(anyTax.amount)],
                  ['Đã quyết toán', yesNo(anyTax.isFinalized)],
                  ['Ngày quyết toán', fmtDate(anyTax.finalizedDate)],
                ]} />
              ) : (
                <DocP><em className="text-muted-foreground">Chưa có dữ liệu kê khai thuế.</em></DocP>
              )}

            </DocFile>

            {/* ── FILE 2: Phương án đấu giá ── */}
            <DocFile label={format === 'SEPARATED' ? '02_Phuong-an-dau-gia.docx' : undefined}>

              <DocH1>PHƯƠNG ÁN ĐẤU GIÁ TÀI SẢN</DocH1>
              <InfoTable rows={[
                ['Tài sản', announcement.assetDescription],
                ['Người có tài sản', announcement.ownerName],
                ['Hạn nộp hồ sơ', fmtDate(announcement.deadline)],
              ]} />

              <DocH2>MỤC III: PHƯƠNG ÁN ĐẤU GIÁ (16 ĐIỂM)</DocH2>

              <DocH3>III.1. Hình thức đấu giá, bước giá, số vòng (8 điểm)</DocH3>
              <DocText text={auctionPlan.format} />

              <DocH3>III.2. Phương án bán, tiếp nhận hồ sơ tham gia đấu giá (2 điểm)</DocH3>
              <DocText text={auctionPlan.receptionPlan} />

              <DocH3>III.3. Đối tượng, điều kiện tham gia đấu giá (3 điểm)</DocH3>
              <DocText text={auctionPlan.participantConditions} />

              <DocH3>III.4. Giải pháp giám sát, chống thông đồng, dìm giá (3 điểm)</DocH3>
              <DocText text={auctionPlan.antiCollusionMeasures} />

              {sectionVCriteria.length > 0 && (
                <>
                  <DocH2>MỤC V: TIÊU CHÍ KHÁC (tối đa 8 điểm)</DocH2>
                  <DataTable
                    headers={['STT', 'Tiêu chí', 'Phân loại', 'Điểm', 'Đáp ứng', 'Bằng chứng']}
                    rows={sectionVCriteria.map((c, i) => [
                      (i + 1).toString(),
                      c.label,
                      c.nature === 'CAPACITY' ? 'Năng lực' : 'Phương án',
                      c.maxPoints.toString(),
                      c.meets === true ? 'Đáp ứng' : c.meets === false ? 'Không' : 'Chưa xác định',
                      c.evidence,
                    ])}
                  />
                </>
              )}

            </DocFile>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DocFile({ children, label }: { children: React.ReactNode; label?: string }) {
  if (!label) return <div className="space-y-3">{children}</div>
  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      {children}
    </div>
  )
}

function DocH1({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold tracking-wide text-foreground border-b border-border pb-1">{children}</h2>
}

function DocH2({ children }: { children: React.ReactNode }) {
  return <h3 className="text-xs font-semibold text-foreground mt-4 mb-1">{children}</h3>
}

function DocH3({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-medium text-foreground/80 mt-3 mb-1">{children}</h4>
}

function DocP({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-foreground leading-relaxed">{children}</p>
}

function DocMuted({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}

function DocText({ text }: { text: string }) {
  if (!text?.trim()) return <p className="text-xs italic text-muted-foreground">Chưa nhập</p>
  return (
    <div className="space-y-0.5">
      {text.split('\n').map((line, i) => (
        <p key={i} className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
          {line || ' '}
        </p>
      ))}
    </div>
  )
}

function InfoTable({ rows }: { rows: [string, string | undefined][] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={i} className="border border-border">
            <td className="px-2 py-1 font-medium bg-muted/40 w-[35%] align-top">{label}</td>
            <td className="px-2 py-1 align-top">{value || <span className="text-muted-foreground">—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="bg-muted/50">
          {headers.map((h, i) => (
            <th key={i} className="border border-border px-2 py-1 text-left font-medium">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border border-border">
            {row.map((cell, j) => (
              <td key={j} className="border border-border px-2 py-1 align-top">
                {cell || <span className="text-muted-foreground">—</span>}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
