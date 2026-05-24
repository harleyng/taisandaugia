import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SectionScoreBadge } from '../SectionScoreBadge'
import { SectionFreshnessIndicator } from '../SectionFreshnessIndicator'
import { PhotoUpload } from '../PhotoUpload'
import { PhotoGrid } from '../PhotoGrid'
import type { CameraSystem, CameraAtAuction, PhotoAttachment } from '@/types/infrastructure'

const OFFICE_LOCATIONS = [
  'Phòng tiếp nhận hồ sơ',
  'Khu vực ngoài trụ sở',
  'Hành lang',
  'Phòng giám đốc',
  'Phòng họp',
  'Kho lưu trữ',
]

const AUCTION_LOCATIONS = [
  'Sảnh/Hội trường đấu giá',
  'Khu vực chờ',
  'Quầy đăng ký',
  'Bục đấu giá viên',
  'Khu vực ngoài',
]

interface CameraCardProps {
  label: string
  subLabel: string
  sectionId: string
  scoreKey: string
  score: number
  maxScore: number
  data: CameraSystem
  locationOptions: string[]
  extra?: React.ReactNode
  onChange: (partial: Partial<CameraSystem>) => void
  freshness: string
}

function CameraCard({
  label,
  sectionId,
  scoreKey,
  score,
  maxScore,
  data,
  locationOptions,
  extra,
  onChange,
  freshness,
}: CameraCardProps) {
  function toggleLocation(loc: string) {
    const current = data.locations
    onChange({
      locations: current.includes(loc)
        ? current.filter((l) => l !== loc)
        : [...current, loc],
    })
  }

  function addPhoto(photo: PhotoAttachment) {
    onChange({ photos: [...data.photos, photo] })
  }
  function removePhoto(id: string) {
    onChange({ photos: data.photos.filter((p) => p.id !== id) })
  }
  function reorderPhotos(from: number, to: number) {
    const photos = [...data.photos]
    const [moved] = photos.splice(from, 1)
    photos.splice(to, 0, moved)
    onChange({ photos })
  }
  function updateCaption(id: string, caption: string) {
    onChange({ photos: data.photos.map((p) => (p.id === id ? { ...p, caption } : p)) })
  }

  return (
    <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm font-semibold">{label}</p>
        <SectionScoreBadge current={score} max={maxScore} />
        <SectionFreshnessIndicator lastUpdatedAt={freshness} />
      </div>

      {extra}

      <div className="flex items-center gap-2">
        <Checkbox
          id={`${scoreKey}-has`}
          checked={data.hasSystem}
          onCheckedChange={(v) => onChange({ hasSystem: !!v })}
        />
        <Label htmlFor={`${scoreKey}-has`} className="font-normal cursor-pointer">
          Có hệ thống camera giám sát
        </Label>
      </div>

      {data.hasSystem && (
        <>
          <div>
            <Label className="mb-2 block text-sm">Vị trí lắp đặt camera</Label>
            <div className="flex flex-wrap gap-2">
              {locationOptions.map((loc) => (
                <div key={loc} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`${scoreKey}-${loc}`}
                    checked={data.locations.includes(loc)}
                    onCheckedChange={() => toggleLocation(loc)}
                  />
                  <Label
                    htmlFor={`${scoreKey}-${loc}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {loc}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${scoreKey}-extract`}
                checked={data.canExtractRecording}
                onCheckedChange={(v) => onChange({ canExtractRecording: !!v })}
              />
              <Label htmlFor={`${scoreKey}-extract`} className="font-normal cursor-pointer">
                Có thể trích xuất ghi hình
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`${scoreKey}-store`}
                checked={data.canStoreWithCase}
                onCheckedChange={(v) => onChange({ canStoreWithCase: !!v })}
              />
              <Label htmlFor={`${scoreKey}-store`} className="font-normal cursor-pointer">
                Có lưu cùng hồ sơ đấu giá
              </Label>
            </div>
          </div>

          <div>
            <Label className="text-sm">Ghi chú kỹ thuật (tuỳ chọn)</Label>
            <Textarea
              value={data.technicalNotes ?? ''}
              onChange={(e) => onChange({ technicalNotes: e.target.value })}
              placeholder="Thương hiệu, số kênh, thời gian lưu trữ..."
              rows={2}
              className="mt-1"
            />
          </div>
        </>
      )}

      <div className="space-y-3" data-section={sectionId}>
        <PhotoUpload
          photos={data.photos}
          sectionId={sectionId}
          sectionLabel={label}
          label="Ảnh hệ thống camera"
          onAdd={addPhoto}
        />
        <PhotoGrid
          photos={data.photos}
          onRemove={removePhoto}
          onReorder={reorderPhotos}
          onCaptionChange={updateCaption}
        />
      </div>
    </div>
  )
}

interface Props {
  officeData: CameraSystem
  auctionData: CameraAtAuction
  officeScore: number
  auctionScore: number
  onOfficeChange: (partial: Partial<CameraSystem>) => void
  onAuctionChange: (partial: Partial<CameraAtAuction>) => void
}

export function CameraSection({
  officeData,
  auctionData,
  officeScore,
  auctionScore,
  onOfficeChange,
  onAuctionChange,
}: Props) {
  function handleSameAsOffice(checked: boolean) {
    if (checked) {
      onAuctionChange({
        isSameAsOffice: true,
        hasSystem: officeData.hasSystem,
        locations: [...officeData.locations],
        canExtractRecording: officeData.canExtractRecording,
        canStoreWithCase: officeData.canStoreWithCase,
      })
    } else {
      onAuctionChange({ isSameAsOffice: false })
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-5 space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-base">📹</span>
        <h3 className="text-base font-semibold">Camera giám sát</h3>
        <span className="text-sm text-muted-foreground">
          {officeScore + auctionScore}/4đ
        </span>
      </div>

      <CameraCard
        label="II.2.1 — Tại trụ sở"
        subLabel="II.2.1"
        sectionId="II.2.1"
        scoreKey="camera-office"
        score={officeScore}
        maxScore={2}
        data={officeData}
        locationOptions={OFFICE_LOCATIONS}
        onChange={onOfficeChange}
        freshness={officeData.lastUpdatedAt}
      />

      <CameraCard
        label="II.2.2 — Tại nơi tổ chức phiên đấu giá"
        subLabel="II.2.2"
        sectionId="II.2.2"
        scoreKey="camera-auction"
        score={auctionScore}
        maxScore={2}
        data={auctionData}
        locationOptions={AUCTION_LOCATIONS}
        extra={
          <div className="flex items-center gap-2">
            <Checkbox
              id="camera-same-location"
              checked={auctionData.isSameAsOffice}
              onCheckedChange={(v) => handleSameAsOffice(!!v)}
            />
            <Label htmlFor="camera-same-location" className="font-normal cursor-pointer text-sm">
              Cùng vị trí với trụ sở (sao chép thông tin từ trên)
            </Label>
          </div>
        }
        onChange={(partial) => onAuctionChange(partial)}
        freshness={auctionData.lastUpdatedAt}
      />
    </div>
  )
}
