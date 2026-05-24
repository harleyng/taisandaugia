import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SectionScoreBadge } from '../SectionScoreBadge'
import { SectionFreshnessIndicator } from '../SectionFreshnessIndicator'
import { PhotoUpload } from '../PhotoUpload'
import { PhotoGrid } from '../PhotoGrid'
import type { OnlineAuctionPlatform, PhotoAttachment } from '@/types/infrastructure'
import type { AuctionRecord } from '@/types/auction-record'

const APPROVAL_AUTHORITIES = [
  'Bộ Tư pháp',
  'Sở Tư pháp',
  'UBND tỉnh/thành phố',
]

const schema = z.object({
  qualificationType: z.enum(['APPROVED', 'CONDUCTED_LAST_YEAR', 'NONE']),
  approvalDocumentNumber: z.string().optional(),
  approvalDate: z.string().optional(),
  approvedBy: z.string().optional(),
  url: z.string().optional(),
  isOwnPlatform: z.enum(['true', 'false']).optional(),
  platformProvider: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  data: OnlineAuctionPlatform
  score: number
  onlineAuctionsLastYear: AuctionRecord[]
  onChange: (partial: Partial<OnlineAuctionPlatform>) => void
}

export function OnlineAuctionSection({ data, score, onlineAuctionsLastYear, onChange }: Props) {
  const { register, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      qualificationType: data.qualificationType,
      approvalDocumentNumber: data.approvalDocumentNumber ?? '',
      approvalDate: data.approvalDate ?? '',
      approvedBy: data.approvedBy ?? '',
      url: data.url ?? '',
      isOwnPlatform: data.isOwnPlatform === undefined ? undefined : (data.isOwnPlatform ? 'true' : 'false'),
      platformProvider: data.platformProvider ?? '',
    },
    mode: 'onChange',
  })

  const qualificationType = watch('qualificationType')
  const isOwnPlatform = watch('isOwnPlatform')

  useEffect(() => {
    const sub = watch((values) => {
      onChange({
        qualificationType: values.qualificationType ?? 'NONE',
        approvalDocumentNumber: values.approvalDocumentNumber,
        approvalDate: values.approvalDate,
        approvedBy: values.approvedBy,
        url: values.url,
        isOwnPlatform: values.isOwnPlatform === 'true' ? true : values.isOwnPlatform === 'false' ? false : undefined,
        platformProvider: values.platformProvider,
      })
    })
    return () => sub.unsubscribe()
  }, [watch, onChange])

  // Sync auto-count from auction history
  useEffect(() => {
    if (data.qualificationType === 'CONDUCTED_LAST_YEAR') {
      onChange({ lastYearOnlineAuctionCount: onlineAuctionsLastYear.length })
    }
  }, [data.qualificationType, onlineAuctionsLastYear.length, onChange])

  function addPhoto(photo: PhotoAttachment) {
    onChange({ screenshots: [...data.screenshots, photo] })
  }
  function removePhoto(id: string) {
    onChange({ screenshots: data.screenshots.filter((p) => p.id !== id) })
  }
  function reorderPhotos(from: number, to: number) {
    const s = [...data.screenshots]
    const [moved] = s.splice(from, 1)
    s.splice(to, 0, moved)
    onChange({ screenshots: s })
  }
  function updateCaption(id: string, caption: string) {
    onChange({ screenshots: data.screenshots.map((p) => (p.id === id ? { ...p, caption } : p)) })
  }

  return (
    <div className="rounded-2xl border bg-white p-5 space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">💻</span>
          <h3 className="text-base font-semibold">Trang đấu giá trực tuyến</h3>
        </div>
        <SectionScoreBadge current={score} max={4} />
        <SectionFreshnessIndicator lastUpdatedAt={data.lastUpdatedAt} />
      </div>

      <div>
        <Label className="mb-2 block text-sm font-medium">Phương án đạt điểm (chọn 1)</Label>
        <RadioGroup
          value={qualificationType}
          onValueChange={(v) => setValue('qualificationType', v as 'APPROVED' | 'CONDUCTED_LAST_YEAR' | 'NONE')}
          className="space-y-2"
        >
          <div className="flex items-start gap-2">
            <RadioGroupItem value="APPROVED" id="oa-approved" className="mt-0.5" />
            <Label htmlFor="oa-approved" className="font-normal cursor-pointer">
              Đã có trang đấu giá trực tuyến được phê duyệt
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="CONDUCTED_LAST_YEAR" id="oa-conducted" className="mt-0.5" />
            <Label htmlFor="oa-conducted" className="font-normal cursor-pointer">
              Năm trước liền kề đã thực hiện ≥1 cuộc đấu giá trực tuyến
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="NONE" id="oa-none" className="mt-0.5" />
            <Label htmlFor="oa-none" className="font-normal cursor-pointer text-muted-foreground">
              Chưa có
            </Label>
          </div>
        </RadioGroup>
      </div>

      {qualificationType === 'APPROVED' && (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>
                Số quyết định phê duyệt <span className="text-destructive">*</span>
              </Label>
              <Input
                {...register('approvalDocumentNumber')}
                placeholder="Vd: 1234/QĐ-BTP"
                className="mt-1"
              />
            </div>
            <div>
              <Label>
                Ngày phê duyệt <span className="text-destructive">*</span>
              </Label>
              <Input type="date" {...register('approvalDate')} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Cơ quan phê duyệt</Label>
            <Select
              value={data.approvedBy ?? ''}
              onValueChange={(v) => setValue('approvedBy', v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Chọn cơ quan..." />
              </SelectTrigger>
              <SelectContent>
                {APPROVAL_AUTHORITIES.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>URL platform đấu giá</Label>
            <Input {...register('url')} placeholder="https://daugia.company.vn" className="mt-1" />
          </div>

          <div>
            <Label className="mb-2 block text-sm">Loại platform</Label>
            <RadioGroup
              value={isOwnPlatform ?? ''}
              onValueChange={(v) => setValue('isOwnPlatform', v as 'true' | 'false')}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="true" id="plat-own" />
                <Label htmlFor="plat-own" className="font-normal cursor-pointer">Tự xây platform</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="false" id="plat-partner" />
                <Label htmlFor="plat-partner" className="font-normal cursor-pointer">Sử dụng của đối tác</Label>
              </div>
            </RadioGroup>

            {isOwnPlatform === 'false' && (
              <div className="mt-3">
                <Label>Tên đối tác cung cấp platform</Label>
                <Input
                  {...register('platformProvider')}
                  placeholder="Vd: Công ty XYZ"
                  className="mt-1"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {qualificationType === 'CONDUCTED_LAST_YEAR' && (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium">Kết quả kiểm tra tự động từ Lịch sử đấu giá</p>

          {onlineAuctionsLastYear.length > 0 ? (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">
                  Đạt điều kiện — tìm thấy {onlineAuctionsLastYear.length} cuộc đấu giá trực tuyến
                </span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {onlineAuctionsLastYear.slice(0, 10).map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="text-muted-foreground">•</span>
                    <span>{r.auctionDate}</span>
                    <span className="truncate">{r.assetDescription}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Chưa tìm thấy cuộc đấu giá trực tuyến năm trước trong Lịch sử đấu giá.
                Vui lòng bổ sung dữ liệu tại module Lịch sử đấu giá.
              </span>
            </div>
          )}
        </div>
      )}

      <div className="border-t pt-4 space-y-3" data-section="onlineAuction">
        <PhotoUpload
          photos={data.screenshots}
          sectionId="II.4"
          sectionLabel="Trang đấu giá trực tuyến"
          label="Ảnh chụp màn hình platform đấu giá"
          onAdd={addPhoto}
        />
        <PhotoGrid
          photos={data.screenshots}
          onRemove={removePhoto}
          onReorder={reorderPhotos}
          onCaptionChange={updateCaption}
        />
      </div>
    </div>
  )
}
