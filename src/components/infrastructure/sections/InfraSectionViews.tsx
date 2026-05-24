import { Image } from 'lucide-react'
import type { Headquarters, ReceptionPoint, CameraSystem, CameraAtAuction, Website, OnlineAuctionPlatform, Archive } from '@/types/infrastructure'

function ViewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value || <span className="text-muted-foreground italic">Chưa nhập</span>}</p>
    </div>
  )
}

function PhotoCount({ count }: { count: number }) {
  if (count === 0) return <p className="text-xs text-muted-foreground italic">Chưa có ảnh minh chứng</p>
  return (
    <p className="text-xs text-muted-foreground flex items-center gap-1">
      <Image className="h-3 w-3" />{count} ảnh minh chứng
    </p>
  )
}

function yesNo(val: boolean) {
  return val ? 'Có' : 'Chưa'
}

// ── Headquarters ──────────────────────────────────────────────────────────────

interface HQViewProps { data: Headquarters }

export function HeadquartersSectionView({ data }: HQViewProps) {
  const address = [data.address, data.ward, data.district, data.province].filter(Boolean).join(', ')
  return (
    <div className="px-5 pb-4 space-y-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <ViewField label="Địa chỉ" value={address} />
        <ViewField label="Tình trạng" value={data.isOwned ? 'Sở hữu' : 'Thuê'} />
        <ViewField label="Số điện thoại" value={data.phone} />
        <ViewField label="Email" value={data.email} />
      </div>
      <PhotoCount count={data.photos.length} />
    </div>
  )
}

// ── Reception Point ───────────────────────────────────────────────────────────

interface RPViewProps { data: ReceptionPoint }

export function ReceptionPointSectionView({ data }: RPViewProps) {
  const days = data.workingDays.length > 0 ? data.workingDays.join(', ') : null
  return (
    <div className="px-5 pb-4 space-y-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <ViewField label="Địa điểm" value={data.isAtHeadquarters ? 'Tại trụ sở' : data.address} />
        <ViewField label="Ngày làm việc" value={days} />
        <ViewField label="Giờ làm việc" value={data.workingHours} />
        <ViewField label="Phương thức thông báo" value={data.publicNoticeMethod} />
      </div>
      <PhotoCount count={data.photos.length} />
    </div>
  )
}

// ── Camera ────────────────────────────────────────────────────────────────────

interface CameraViewProps {
  officeData: CameraSystem
  auctionData: CameraAtAuction
}

export function CameraSectionView({ officeData, auctionData }: CameraViewProps) {
  return (
    <div className="px-5 pb-4 space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Camera tại trụ sở</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <ViewField label="Hệ thống camera" value={yesNo(officeData.hasSystem)} />
          <ViewField label="Trích xuất ghi hình" value={yesNo(officeData.canExtractRecording)} />
        </div>
        <PhotoCount count={officeData.photos.length} />
      </div>
      <div className="border-t pt-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Camera tại phiên đấu giá</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <ViewField label="Hệ thống camera" value={yesNo(auctionData.hasSystem)} />
          <ViewField label="Trích xuất ghi hình" value={yesNo(auctionData.canExtractRecording)} />
          <ViewField label="Lưu theo hồ sơ" value={yesNo(auctionData.canStoreWithCase)} />
        </div>
        <PhotoCount count={auctionData.photos.length} />
      </div>
    </div>
  )
}

// ── Website & Online Auction ──────────────────────────────────────────────────

const QUALIFICATION_LABELS: Record<string, string> = {
  APPROVED: 'Có quyết định phê duyệt',
  CONDUCTED_LAST_YEAR: 'Đã thực hiện năm trước',
  NONE: 'Chưa đăng ký',
}

interface WebViewProps {
  websiteData: Website
  auctionData: OnlineAuctionPlatform
}

export function WebsiteAndAuctionSectionView({ websiteData, auctionData }: WebViewProps) {
  return (
    <div className="px-5 pb-4 space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trang thông tin điện tử</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <ViewField label="URL website" value={websiteData.url} />
          <ViewField label="Cập nhật thường xuyên" value={yesNo(websiteData.hasRegularUpdates)} />
        </div>
        <PhotoCount count={websiteData.screenshots.length} />
      </div>
      <div className="border-t pt-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Trang đấu giá trực tuyến</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          <ViewField label="Hình thức" value={QUALIFICATION_LABELS[auctionData.qualificationType]} />
          {auctionData.url && <ViewField label="URL nền tảng" value={auctionData.url} />}
        </div>
        <PhotoCount count={auctionData.screenshots.length} />
      </div>
    </div>
  )
}

// ── Archive ───────────────────────────────────────────────────────────────────

const STORAGE_LABELS: Record<string, string> = {
  CABINET: 'Tủ tài liệu chuyên dụng',
  ROOM: 'Phòng lưu trữ riêng',
  WAREHOUSE: 'Kho lưu trữ',
  DIGITAL: 'Lưu trữ điện tử',
  HYBRID: 'Kết hợp (giấy + điện tử)',
}

interface ArchiveViewProps { data: Archive }

export function ArchiveSectionView({ data }: ArchiveViewProps) {
  return (
    <div className="px-5 pb-4 space-y-3">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <ViewField label="Địa điểm" value={data.isAtHeadquarters ? 'Tại trụ sở' : data.address} />
        <ViewField label="Hình thức lưu trữ" value={STORAGE_LABELS[data.storageType]} />
        <ViewField
          label="Biện pháp an toàn"
          value={data.securityMeasures.length > 0 ? `${data.securityMeasures.length} biện pháp` : null}
        />
        {data.area && <ViewField label="Diện tích" value={`${data.area} m²`} />}
      </div>
      <PhotoCount count={data.photos.length} />
    </div>
  )
}
