import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SectionScoreBadge } from '../SectionScoreBadge'
import { SectionFreshnessIndicator } from '../SectionFreshnessIndicator'
import { PhotoUpload } from '../PhotoUpload'
import { PhotoGrid } from '../PhotoGrid'
import type { ReceptionPoint, PhotoAttachment } from '@/types/infrastructure'

const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const schema = z.object({
  isAtHeadquarters: z.boolean(),
  address: z.string().optional(),
  workingHours: z.string(),
  publicNoticeMethod: z.string(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  data: ReceptionPoint
  score: number
  onChange: (partial: Partial<ReceptionPoint>) => void
}

export function ReceptionPointSection({ data, score, onChange }: Props) {
  const { register, watch, setValue } = useForm<FormValues>({
    defaultValues: {
      isAtHeadquarters: data.isAtHeadquarters,
      address: data.address ?? '',
      workingHours: data.workingHours,
      publicNoticeMethod: data.publicNoticeMethod,
    },
    resolver: zodResolver(schema),
    mode: 'onChange',
  })

  const isAtHQ = watch('isAtHeadquarters')

  useEffect(() => {
    const sub = watch((values) => {
      onChange({
        isAtHeadquarters: values.isAtHeadquarters ?? true,
        address: values.address,
        workingHours: values.workingHours ?? '',
        publicNoticeMethod: values.publicNoticeMethod ?? '',
      })
    })
    return () => sub.unsubscribe()
  }, [watch, onChange])

  function toggleDay(day: string) {
    const current = data.workingDays
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day]
    onChange({ workingDays: updated })
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
    <div className="rounded-2xl border bg-white p-5 space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">🏢</span>
          <h3 className="text-base font-semibold">Địa điểm bán, tiếp nhận hồ sơ tham gia</h3>
        </div>
        <SectionScoreBadge current={score} max={1.5} />
        <SectionFreshnessIndicator lastUpdatedAt={data.lastUpdatedAt} />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="reception-same"
          checked={isAtHQ}
          onCheckedChange={(v) => setValue('isAtHeadquarters', !!v)}
        />
        <Label htmlFor="reception-same" className="font-normal cursor-pointer">
          Cùng địa chỉ trụ sở
        </Label>
      </div>

      {!isAtHQ && (
        <div>
          <Label>Địa chỉ tiếp nhận hồ sơ</Label>
          <Input {...register('address')} placeholder="Địa chỉ khác trụ sở..." className="mt-1" />
        </div>
      )}

      <div>
        <Label>
          Giờ làm việc <span className="text-destructive">*</span>
        </Label>
        <Input
          {...register('workingHours')}
          placeholder="Vd: Sáng 8:00–12:00, Chiều 13:30–17:00"
          className="mt-1"
        />
      </div>

      <div>
        <Label className="mb-2 block">Các ngày làm việc</Label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={`rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
                data.workingDays.includes(day)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-white text-foreground border-border hover:border-primary'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>
          Phương thức thông báo công khai <span className="text-destructive">*</span>
        </Label>
        <Textarea
          {...register('publicNoticeMethod')}
          placeholder="Mô tả cách công ty thông báo công khai địa điểm tiếp nhận (trên website, Cổng TTĐT QG, biển hiệu trước trụ sở...)"
          rows={3}
          className="mt-1"
        />
      </div>

      <div className="border-t pt-4 space-y-3" data-section="receptionPoint">
        <PhotoUpload
          photos={data.photos}
          sectionId="II.1.2"
          sectionLabel="Địa điểm tiếp nhận hồ sơ"
          label="Ảnh khu vực tiếp nhận hồ sơ, biển hướng dẫn"
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
