import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import type { AuctionRecord } from '@/types/auction-record'
import { ASSET_CATEGORY_LABELS, AUCTION_FORMAT_LABELS, type AssetCategory, type AuctionFormat } from '@/types/auction-record'
import { classifyAsset } from '@/lib/auction-history/classify'

const schema = z.object({
  auctionDate: z.string().min(1, 'Vui lòng chọn ngày'),
  auctionNumber: z.string().optional(),
  assetDescription: z.string().min(3, 'Mô tả tối thiểu 3 ký tự'),
  assetCategory: z.string(),
  assetLocation: z.string().optional(),
  ownerName: z.string().min(2, 'Tối thiểu 2 ký tự'),
  contractNumber: z.string().optional(),
  startingPrice: z.string().min(1, 'Vui lòng nhập giá khởi điểm'),
  winningPrice: z.string().optional(),
  isSuccessful: z.string().optional(),
  failureReason: z.string().optional(),
  auctionFormat: z.string().optional(),
  bidStep: z.string().optional(),
  maxRounds: z.string().optional(),
  actualRounds: z.string().optional(),
  numberOfParticipants: z.string().optional(),
  depositPercentage: z.string().optional(),
  internalNotes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  record?: AuctionRecord
  onSave: (record: AuctionRecord) => void
}

const parseNum = (s?: string) => {
  if (!s) return undefined
  const n = Number(s.replace(/[,.\s]/g, ''))
  return isNaN(n) ? undefined : n
}

function toFormValues(r: AuctionRecord): FormValues {
  return {
    auctionDate: r.auctionDate,
    auctionNumber: r.auctionNumber ?? '',
    assetDescription: r.assetDescription,
    assetCategory: r.assetCategory,
    assetLocation: r.assetLocation ?? '',
    ownerName: r.ownerName,
    contractNumber: r.contractNumber ?? '',
    startingPrice: r.startingPrice ? r.startingPrice.toLocaleString('vi-VN') : '',
    winningPrice: r.winningPrice ? r.winningPrice.toLocaleString('vi-VN') : '',
    isSuccessful: r.isSuccessful === true ? 'true' : r.isSuccessful === false ? 'false' : '',
    failureReason: r.failureReason ?? '',
    auctionFormat: r.auctionFormat ?? '',
    bidStep: r.bidStep ? r.bidStep.toLocaleString('vi-VN') : '',
    maxRounds: r.maxRounds ? String(r.maxRounds) : '',
    actualRounds: r.actualRounds ? String(r.actualRounds) : '',
    numberOfParticipants: r.numberOfParticipants ? String(r.numberOfParticipants) : '',
    depositPercentage: r.depositPercentage ? String(r.depositPercentage) : '',
    internalNotes: r.internalNotes ?? '',
  }
}

export function AuctionFormDialog({ open, onClose, record, onSave }: Props) {
  const isEdit = !!record
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: record ? toFormValues(record) : {
      auctionDate: '', assetDescription: '', assetCategory: 'OTHER', ownerName: '', startingPrice: '',
    },
  })

  useEffect(() => {
    if (open) {
      form.reset(record ? toFormValues(record) : { auctionDate: '', assetDescription: '', assetCategory: 'OTHER', ownerName: '', startingPrice: '' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record])

  const onSubmit = (values: FormValues) => {
    const now = new Date().toISOString()
    const autoCategory = classifyAsset(values.assetDescription)
    const saved: AuctionRecord = {
      id: record?.id ?? crypto.randomUUID(),
      orgId: 'default',
      source: record?.source ?? 'MANUAL',
      auctionDate: values.auctionDate,
      auctionNumber: values.auctionNumber || undefined,
      assetDescription: values.assetDescription,
      assetCategory: (values.assetCategory as AssetCategory) || autoCategory.category,
      assetCategoryConfidence: autoCategory.confidence,
      assetLocation: values.assetLocation || undefined,
      ownerName: values.ownerName,
      contractNumber: values.contractNumber || undefined,
      startingPrice: parseNum(values.startingPrice) ?? 0,
      winningPrice: parseNum(values.winningPrice),
      isSuccessful: values.isSuccessful === 'true' ? true : values.isSuccessful === 'false' ? false : undefined,
      failureReason: values.failureReason || undefined,
      auctionFormat: (values.auctionFormat as AuctionFormat) || undefined,
      bidStep: parseNum(values.bidStep),
      maxRounds: values.maxRounds ? Number(values.maxRounds) : undefined,
      actualRounds: values.actualRounds ? Number(values.actualRounds) : undefined,
      numberOfParticipants: values.numberOfParticipants ? Number(values.numberOfParticipants) : undefined,
      depositPercentage: values.depositPercentage ? Number(values.depositPercentage) : undefined,
      internalNotes: values.internalNotes || undefined,
      fieldSources: record?.fieldSources ?? {},
      overrides: record?.overrides ?? [],
      attachedDocuments: record?.attachedDocuments ?? [],
      isVerifiedByUser: record?.isVerifiedByUser ?? false,
      isDisputed: record?.isDisputed ?? false,
      createdAt: record?.createdAt ?? now,
      updatedAt: now,
    }
    onSave(saved)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Chỉnh sửa cuộc đấu giá' : 'Thêm cuộc đấu giá'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thông tin tài sản</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="auctionDate" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Ngày đấu giá *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage className="text-xs" /></FormItem>
                )} />
                <FormField control={form.control} name="auctionNumber" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Số phiên</FormLabel>
                    <FormControl><Input placeholder="PĐG-001" {...field} /></FormControl></FormItem>
                )} />
              </div>

              <FormField control={form.control} name="assetDescription" render={({ field }) => (
                <FormItem><FormLabel className="text-xs">Mô tả tài sản *</FormLabel>
                  <FormControl><Textarea rows={2} placeholder="Quyền sử dụng đất tại..." {...field} /></FormControl>
                  <FormMessage className="text-xs" /></FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="assetCategory" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Loại tài sản</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(Object.entries(ASSET_CATEGORY_LABELS) as [AssetCategory, string][]).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select></FormItem>
                )} />
                <FormField control={form.control} name="assetLocation" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Địa chỉ tài sản</FormLabel>
                    <FormControl><Input placeholder="Hà Nội" {...field} /></FormControl></FormItem>
                )} />
              </div>
            </div>

            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Bên liên quan</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="ownerName" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Người có tài sản *</FormLabel>
                    <FormControl><Input placeholder="Nguyễn Văn A" {...field} /></FormControl>
                    <FormMessage className="text-xs" /></FormItem>
                )} />
                <FormField control={form.control} name="contractNumber" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Số HĐ dịch vụ</FormLabel>
                    <FormControl><Input placeholder="HĐ-001/2024" {...field} /></FormControl></FormItem>
                )} />
              </div>
            </div>

            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Giá cả & Kết quả</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="startingPrice" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Giá khởi điểm (VND) *</FormLabel>
                    <FormControl><Input placeholder="5,000,000,000" {...field} /></FormControl>
                    <FormMessage className="text-xs" /></FormItem>
                )} />
                <FormField control={form.control} name="winningPrice" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Giá trúng (VND) ★</FormLabel>
                    <FormControl><Input placeholder="5,500,000,000" {...field} /></FormControl></FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="isSuccessful" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Trạng thái</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Chọn..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="true">Thành công</SelectItem>
                        <SelectItem value="false">Không thành</SelectItem>
                      </SelectContent>
                    </Select></FormItem>
                )} />
                <FormField control={form.control} name="failureReason" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Lý do không thành</FormLabel>
                    <FormControl><Input placeholder="Không có người tham gia" {...field} /></FormControl></FormItem>
                )} />
              </div>
            </div>

            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chi tiết đấu giá</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="auctionFormat" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Hình thức đấu giá ★</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Chọn..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(Object.entries(AUCTION_FORMAT_LABELS) as [AuctionFormat, string][]).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select></FormItem>
                )} />
                <FormField control={form.control} name="bidStep" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Bước giá (VND) ★</FormLabel>
                    <FormControl><Input placeholder="100,000,000" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="maxRounds" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Số vòng tối đa</FormLabel>
                    <FormControl><Input type="number" min="1" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="actualRounds" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Số vòng thực tế</FormLabel>
                    <FormControl><Input type="number" min="1" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="numberOfParticipants" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Số người tham gia</FormLabel>
                    <FormControl><Input type="number" min="0" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="depositPercentage" render={({ field }) => (
                  <FormItem><FormLabel className="text-xs">Tiền đặt trước (%)</FormLabel>
                    <FormControl><Input type="number" min="0" max="100" step="0.5" {...field} /></FormControl></FormItem>
                )} />
              </div>
            </div>

            <Separator />
            <FormField control={form.control} name="internalNotes" render={({ field }) => (
              <FormItem><FormLabel className="text-xs">Ghi chú nội bộ</FormLabel>
                <FormControl><Textarea rows={2} placeholder="Ghi chú..." {...field} /></FormControl></FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
              <Button type="submit">{isEdit ? 'Lưu thay đổi' : 'Thêm cuộc đấu giá'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
