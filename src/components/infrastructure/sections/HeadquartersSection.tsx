import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { SectionScoreBadge } from '../SectionScoreBadge'
import { SectionFreshnessIndicator } from '../SectionFreshnessIndicator'
import { AddressInput } from '../AddressInput'
import { PhotoUpload } from '../PhotoUpload'
import { PhotoGrid } from '../PhotoGrid'
import type { Headquarters, PhotoAttachment } from '@/types/infrastructure'

const schema = z.object({
  address: z.string(),
  ward: z.string(),
  district: z.string(),
  province: z.string(),
  phone: z.string(),
  email: z.string(),
  workingArea: z.coerce.number().optional(),
  floorCount: z.coerce.number().optional(),
  isOwned: z.enum(['true', 'false']),
  leaseEndDate: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  data: Headquarters
  score: number
  onChange: (partial: Partial<Headquarters>) => void
}

export function HeadquartersSection({ data, score, onChange }: Props) {
  const { register, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      address: data.address,
      ward: data.ward,
      district: data.district,
      province: data.province,
      phone: data.phone,
      email: data.email,
      workingArea: data.workingArea,
      floorCount: data.floorCount,
      isOwned: data.isOwned ? 'true' : 'false',
      leaseEndDate: data.leaseEndDate ?? '',
    },
    mode: 'onChange',
  })

  const isOwned = watch('isOwned')

  useEffect(() => {
    const sub = watch((values) => {
      onChange({
        address: values.address ?? '',
        ward: values.ward ?? '',
        district: values.district ?? '',
        province: values.province ?? '',
        phone: values.phone ?? '',
        email: values.email ?? '',
        workingArea: values.workingArea,
        floorCount: values.floorCount,
        isOwned: values.isOwned === 'true',
        leaseEndDate: values.leaseEndDate,
      })
    })
    return () => sub.unsubscribe()
  }, [watch, onChange])

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
    onChange({
      photos: data.photos.map((p) => (p.id === id ? { ...p, caption } : p)),
    })
  }

  return (
    <div className="rounded-2xl border bg-white p-5 space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-base">📍</span>
          <h3 className="text-base font-semibold">Trụ sở</h3>
        </div>
        <SectionScoreBadge current={score} max={1.5} />
        <SectionFreshnessIndicator lastUpdatedAt={data.lastUpdatedAt} />
      </div>

      <AddressInput
        value={{ address: data.address, ward: data.ward, district: data.district, province: data.province }}
        onChange={(addr) => {
          setValue('address', addr.address)
          setValue('ward', addr.ward)
          setValue('district', addr.district)
          setValue('province', addr.province)
          onChange(addr)
        }}
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>
            Số điện thoại <span className="text-destructive">*</span>
          </Label>
          <Input
            {...register('phone')}
            placeholder="0XX-XXX-XXXX"
            className="mt-1"
          />
          {errors.phone && <p className="text-xs text-destructive mt-1">{errors.phone.message}</p>}
        </div>
        <div>
          <Label>
            Email <span className="text-destructive">*</span>
          </Label>
          <Input {...register('email')} placeholder="contact@company.vn" className="mt-1" />
          {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium">Tình trạng sở hữu</Label>
        <RadioGroup
          value={isOwned}
          onValueChange={(v) => setValue('isOwned', v as 'true' | 'false')}
          className="flex gap-4 mt-2"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="true" id="owned-yes" />
            <Label htmlFor="owned-yes" className="font-normal cursor-pointer">Sở hữu</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="false" id="owned-no" />
            <Label htmlFor="owned-no" className="font-normal cursor-pointer">Thuê</Label>
          </div>
        </RadioGroup>
      </div>

      {isOwned === 'false' && (
        <div>
          <Label>Ngày hết hạn hợp đồng thuê</Label>
          <Input type="date" {...register('leaseEndDate')} className="mt-1 max-w-xs" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Diện tích làm việc (m²)</Label>
          <Input
            type="number"
            min={0}
            {...register('workingArea')}
            placeholder="Vd: 120"
            className="mt-1"
          />
        </div>
        <div>
          <Label>Số tầng</Label>
          <Input
            type="number"
            min={1}
            {...register('floorCount')}
            placeholder="Vd: 3"
            className="mt-1"
          />
        </div>
      </div>

      <div className="border-t pt-4 space-y-3" data-section="headquarters">
        <PhotoUpload
          photos={data.photos}
          sectionId="II.1.1"
          sectionLabel="Trụ sở"
          label="Ảnh minh chứng trụ sở (≥2 ảnh khuyến nghị)"
          hint="Chụp ảnh biển hiệu công ty rõ ràng, không gian làm việc, lối vào trụ sở"
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
