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
import { PhotoUpload } from '../PhotoUpload'
import { PhotoGrid } from '../PhotoGrid'
import type { Archive, PhotoAttachment } from '@/types/infrastructure'

const STORAGE_TYPES = [
  { value: 'CABINET', label: 'Tủ tài liệu chuyên dụng' },
  { value: 'ROOM', label: 'Phòng lưu trữ riêng' },
  { value: 'WAREHOUSE', label: 'Kho lưu trữ' },
  { value: 'DIGITAL', label: 'Lưu trữ điện tử' },
  { value: 'HYBRID', label: 'Kết hợp (giấy + điện tử)' },
] as const

const SECURITY_MEASURES = [
  'Khóa, kiểm soát truy cập',
  'Phòng cháy chữa cháy',
  'Chống ẩm mốc',
  'Camera giám sát khu vực lưu trữ',
  'Backup điện tử',
]

const schema = z.object({
  isAtHeadquarters: z.boolean(),
  address: z.string().optional(),
  area: z.coerce.number().optional(),
  storageType: z.enum(['CABINET', 'ROOM', 'WAREHOUSE', 'DIGITAL', 'HYBRID']),
})

type FormValues = z.infer<typeof schema>

interface Props {
  data: Archive
  score: number
  onChange: (partial: Partial<Archive>) => void
}

export function ArchiveSection({ data, score, onChange }: Props) {
  const { register, watch, setValue } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      isAtHeadquarters: data.isAtHeadquarters,
      address: data.address ?? '',
      area: data.area,
      storageType: data.storageType,
    },
    mode: 'onChange',
  })

  const isAtHQ = watch('isAtHeadquarters')

  useEffect(() => {
    const sub = watch((values) => {
      onChange({
        isAtHeadquarters: values.isAtHeadquarters ?? true,
        address: values.address,
        area: values.area,
        storageType: values.storageType ?? 'CABINET',
      })
    })
    return () => sub.unsubscribe()
  }, [watch, onChange])

  function toggleMeasure(measure: string) {
    const current = data.securityMeasures
    onChange({
      securityMeasures: current.includes(measure)
        ? current.filter((m) => m !== measure)
        : [...current, measure],
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
    <div className="rounded-2xl border bg-white p-5 space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">💾</span>
          <h3 className="text-base font-semibold">Nơi lưu trữ hồ sơ đấu giá</h3>
        </div>
        <SectionScoreBadge current={score} max={4} />
        <SectionFreshnessIndicator lastUpdatedAt={data.lastUpdatedAt} />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="archive-same"
          checked={isAtHQ}
          onCheckedChange={(v) => setValue('isAtHeadquarters', !!v)}
        />
        <Label htmlFor="archive-same" className="font-normal cursor-pointer">
          Cùng địa chỉ trụ sở
        </Label>
      </div>

      {!isAtHQ && (
        <div>
          <Label>Địa chỉ nơi lưu trữ</Label>
          <Input {...register('address')} placeholder="Địa chỉ khác trụ sở..." className="mt-1" />
        </div>
      )}

      <div>
        <Label>Diện tích khu lưu trữ (m²)</Label>
        <Input
          type="number"
          min={0}
          {...register('area')}
          placeholder="Vd: 20"
          className="mt-1 max-w-xs"
        />
      </div>

      <div>
        <Label className="mb-2 block text-sm font-medium">Hình thức lưu trữ</Label>
        <RadioGroup
          value={data.storageType}
          onValueChange={(v) => setValue('storageType', v as Archive['storageType'])}
          className="space-y-2"
        >
          {STORAGE_TYPES.map((s) => (
            <div key={s.value} className="flex items-center gap-2">
              <RadioGroupItem value={s.value} id={`storage-${s.value}`} />
              <Label htmlFor={`storage-${s.value}`} className="font-normal cursor-pointer">
                {s.label}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div>
        <Label className="mb-2 block text-sm font-medium">
          Biện pháp đảm bảo an toàn <span className="text-destructive">*</span>
        </Label>
        <div className="space-y-2">
          {SECURITY_MEASURES.map((m) => (
            <div key={m} className="flex items-center gap-2">
              <Checkbox
                id={`security-${m}`}
                checked={data.securityMeasures.includes(m)}
                onCheckedChange={() => toggleMeasure(m)}
              />
              <Label htmlFor={`security-${m}`} className="font-normal cursor-pointer text-sm">
                {m}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t pt-4 space-y-3" data-section="archive">
        <PhotoUpload
          photos={data.photos}
          sectionId="II.5"
          sectionLabel="Nơi lưu trữ hồ sơ"
          label="Ảnh minh chứng khu lưu trữ"
          hint="Chụp ảnh tủ tài liệu, phòng lưu trữ, hệ thống bảo mật"
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
