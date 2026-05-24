import { useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NumberInput } from '@/components/ui/number-input'
import { Announcement } from '@/types/application'
import { ASSET_CATEGORY_OPTIONS } from '@/lib/applications/labels'
import { vietnamProvinces } from '@/constants/vietnam-locations'
import { AnnouncementImport } from '@/components/applications/AnnouncementImport'

const schema = z.object({
  ownerName: z.string().min(1, 'Bắt buộc'),
  assetDescription: z.string().min(1, 'Bắt buộc'),
  assetCategory: z.string().min(1, 'Chọn loại tài sản'),
  startingPrice: z.union([z.number().positive('Phải lớn hơn 0'), z.string()]),
  assetLocation: z.string(),
  province: z.string().min(1, 'Chọn tỉnh/thành'),
  deadline: z.string().min(1, 'Bắt buộc'),
  announcementUrl: z.string(),
  announcementNumber: z.string(),
  announcementDate: z.string(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  announcement: Announcement
  onChange: (data: Partial<Announcement>) => void
}

export function Section1Announcement({ announcement, onChange }: Props) {
  const { register, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: announcement as FormValues,
    mode: 'onChange',
  })

  // Sync form → parent on every change
  useEffect(() => {
    const sub = watch((values) => {
      onChange(values as Partial<Announcement>)
    })
    return () => sub.unsubscribe()
  }, [watch, onChange])

  // Receive auto-filled data from AnnouncementImport and apply to form
  const handleImportFilled = useCallback(
    (data: Partial<Announcement>) => {
      const setOpt = { shouldValidate: true, shouldDirty: true }
      if (data.ownerName) setValue('ownerName', data.ownerName, setOpt)
      if (data.assetDescription) setValue('assetDescription', data.assetDescription, setOpt)
      if (data.assetCategory) setValue('assetCategory', data.assetCategory as string, setOpt)
      if (data.startingPrice !== undefined) setValue('startingPrice', data.startingPrice, setOpt)
      if (data.assetLocation) setValue('assetLocation', data.assetLocation, setOpt)
      if (data.province) setValue('province', data.province, setOpt)
      if (data.deadline) setValue('deadline', data.deadline, setOpt)
      if (data.announcementNumber) setValue('announcementNumber', data.announcementNumber, setOpt)
      if (data.announcementDate) setValue('announcementDate', data.announcementDate, setOpt)
      if (data.announcementUrl) setValue('announcementUrl', data.announcementUrl, setOpt)
    },
    [setValue]
  )

  return (
    <Card className="p-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Thông tin thông báo lựa chọn</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Nhập thủ công hoặc trích xuất tự động từ link thông báo
        </p>
      </div>

      {/* Auto-import from URL */}
      <AnnouncementImport onFilled={handleImportFilled} />

      {/* Manual fields */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Owner name */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="ownerName">
            Người có tài sản <span className="text-destructive">*</span>
          </Label>
          <Input
            id="ownerName"
            placeholder="VD: UBND Quận Long Biên, TP. Hà Nội"
            {...register('ownerName')}
          />
          {errors.ownerName && <p className="text-xs text-destructive">{errors.ownerName.message}</p>}
        </div>

        {/* Asset description */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="assetDescription">
            Mô tả tài sản <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="assetDescription"
            rows={2}
            placeholder="VD: Quyền sử dụng đất ở tại số 42 đường Ngô Gia Tự..."
            {...register('assetDescription')}
          />
          {errors.assetDescription && <p className="text-xs text-destructive">{errors.assetDescription.message}</p>}
        </div>

        {/* Asset category */}
        <div className="space-y-1.5">
          <Label>
            Loại tài sản <span className="text-destructive">*</span>
          </Label>
          <Select
            value={watch('assetCategory') as string}
            onValueChange={(v) => setValue('assetCategory', v, { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Chọn loại tài sản" />
            </SelectTrigger>
            <SelectContent>
              {ASSET_CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.assetCategory && <p className="text-xs text-destructive">{errors.assetCategory.message}</p>}
        </div>

        {/* Starting price */}
        <div className="space-y-1.5">
          <Label htmlFor="startingPrice">
            Giá khởi điểm (VNĐ) <span className="text-destructive">*</span>
          </Label>
          <NumberInput
            id="startingPrice"
            placeholder="4.500.000.000"
            allowDecimal={false}
            value={String(watch('startingPrice') ?? '')}
            onChange={(v) => setValue('startingPrice', v ? Number(v) : '', { shouldValidate: true })}
          />
          {errors.startingPrice && <p className="text-xs text-destructive">{errors.startingPrice.message as string}</p>}
        </div>

        {/* Province */}
        <div className="space-y-1.5">
          <Label>
            Tỉnh/thành nơi có tài sản <span className="text-destructive">*</span>
          </Label>
          <Select
            value={watch('province')}
            onValueChange={(v) => setValue('province', v, { shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Chọn tỉnh/thành" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {vietnamProvinces.map((p) => (
                <SelectItem key={p.name} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.province && <p className="text-xs text-destructive">{errors.province.message}</p>}
        </div>

        {/* Deadline */}
        <div className="space-y-1.5">
          <Label htmlFor="deadline">
            Hạn nộp hồ sơ <span className="text-destructive">*</span>
          </Label>
          <Input id="deadline" type="date" {...register('deadline')} />
          {errors.deadline && <p className="text-xs text-destructive">{errors.deadline.message}</p>}
        </div>

        {/* Asset location */}
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="assetLocation">Địa chỉ tài sản</Label>
          <Input
            id="assetLocation"
            placeholder="Địa chỉ chi tiết của tài sản"
            {...register('assetLocation')}
          />
        </div>

        {/* Optional announcement info */}
        <div className="md:col-span-2 pt-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Thông tin thông báo (tùy chọn)
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="announcementNumber">Số thông báo</Label>
          <Input id="announcementNumber" placeholder="TB-123/2026/..." {...register('announcementNumber')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="announcementDate">Ngày thông báo</Label>
          <Input id="announcementDate" type="date" {...register('announcementDate')} />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="announcementUrl">Link thông báo (để lưu tham khảo)</Label>
          <Input id="announcementUrl" type="url" placeholder="https://..." {...register('announcementUrl')} />
        </div>
      </div>
    </Card>
  )
}
