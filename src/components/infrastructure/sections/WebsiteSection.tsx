import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { SectionScoreBadge } from '../SectionScoreBadge'
import { SectionFreshnessIndicator } from '../SectionFreshnessIndicator'
import { WebsiteStatusBadge } from '../WebsiteStatusBadge'
import { PhotoUpload } from '../PhotoUpload'
import { PhotoGrid } from '../PhotoGrid'
import type { Website, PhotoAttachment } from '@/types/infrastructure'

const schema = z.object({
  type: z.enum(['OWN_DOMAIN', 'SUB_PORTAL_DOJ']),
  url: z.string(),
  hasRegularUpdates: z.boolean(),
  lastContentUpdateDate: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  data: Website
  score: number
  onChange: (partial: Partial<Website>) => void
}

export function WebsiteSection({ data, score, onChange }: Props) {
  const { register, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: data.type,
      url: data.url,
      hasRegularUpdates: data.hasRegularUpdates,
      lastContentUpdateDate: data.lastContentUpdateDate ?? '',
    },
    mode: 'onChange',
  })

  const hasRegularUpdates = watch('hasRegularUpdates')

  useEffect(() => {
    const sub = watch((values) => {
      onChange({
        type: values.type ?? 'OWN_DOMAIN',
        url: values.url ?? '',
        hasRegularUpdates: values.hasRegularUpdates ?? false,
        lastContentUpdateDate: values.lastContentUpdateDate,
      })
    })
    return () => sub.unsubscribe()
  }, [watch, onChange])

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
          <span className="text-base">🌐</span>
          <h3 className="text-base font-semibold">Trang thông tin điện tử</h3>
        </div>
        <SectionScoreBadge current={score} max={4} />
        <SectionFreshnessIndicator lastUpdatedAt={data.lastUpdatedAt} />
      </div>

      <div>
        <Label className="mb-2 block text-sm font-medium">Loại trang</Label>
        <RadioGroup
          value={data.type}
          onValueChange={(v) => setValue('type', v as 'OWN_DOMAIN' | 'SUB_PORTAL_DOJ')}
          className="space-y-2"
        >
          <div className="flex items-start gap-2">
            <RadioGroupItem value="OWN_DOMAIN" id="site-own" className="mt-0.5" />
            <div>
              <Label htmlFor="site-own" className="font-normal cursor-pointer">
                Trang riêng của công ty (domain độc lập)
              </Label>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="SUB_PORTAL_DOJ" id="site-doj" className="mt-0.5" />
            <div>
              <Label htmlFor="site-doj" className="font-normal cursor-pointer">
                Trang trực thuộc Cổng TTĐT Sở Tư pháp
              </Label>
              <p className="text-xs text-muted-foreground">
                Chỉ dành cho Trung tâm Dịch vụ Đấu giá tài sản
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      <div>
        <Label>
          URL website <span className="text-destructive">*</span>
        </Label>
        <div className="flex items-center gap-2 mt-1">
          <Input
            {...register('url')}
            placeholder="https://www.daugia-xyz.com"
            className="flex-1"
          />
          <WebsiteStatusBadge
            url={data.url}
            isReachable={data.isReachable}
            lastChecked={data.lastChecked}
            onCheck={(reachable) =>
              onChange({ isReachable: reachable, lastChecked: new Date().toISOString() })
            }
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="site-updates"
            checked={hasRegularUpdates}
            onCheckedChange={(v) => setValue('hasRegularUpdates', !!v)}
          />
          <Label htmlFor="site-updates" className="font-normal cursor-pointer">
            Có cập nhật nội dung thường xuyên
          </Label>
        </div>

        {hasRegularUpdates && (
          <div>
            <Label>Ngày cập nhật nội dung gần nhất</Label>
            <Input
              type="date"
              {...register('lastContentUpdateDate')}
              className="mt-1 max-w-xs"
            />
          </div>
        )}
      </div>

      <div className="border-t pt-4 space-y-3" data-section="website">
        <PhotoUpload
          photos={data.screenshots}
          sectionId="II.3"
          sectionLabel="Trang thông tin điện tử"
          label="Ảnh chụp màn hình website (≥1 ảnh)"
          hint="Khuyến nghị: chụp homepage + 1 trang nội dung để chứng minh website đang hoạt động"
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
