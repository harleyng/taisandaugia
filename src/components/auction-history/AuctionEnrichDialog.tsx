import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Lock } from 'lucide-react'
import type { AuctionRecord } from '@/types/auction-record'
import { AUCTION_FORMAT_LABELS, type AuctionFormat } from '@/types/auction-record'
import { format } from 'date-fns'

const schema = z.object({
  contractNumber: z.string().optional(),
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

export function AuctionEnrichDialog({ open, onClose, record, onSave }: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {},
  })

  useEffect(() => {
    if (open && record) {
      form.reset({
        contractNumber: record.contractNumber ?? '',
        winningPrice: record.winningPrice ? record.winningPrice.toLocaleString('vi-VN') : '',
        isSuccessful: record.isSuccessful === true ? 'true' : record.isSuccessful === false ? 'false' : '',
        failureReason: record.failureReason ?? '',
        auctionFormat: record.auctionFormat ?? '',
        bidStep: record.bidStep ? record.bidStep.toLocaleString('vi-VN') : '',
        maxRounds: record.maxRounds ? String(record.maxRounds) : '',
        actualRounds: record.actualRounds ? String(record.actualRounds) : '',
        numberOfParticipants: record.numberOfParticipants ? String(record.numberOfParticipants) : '',
        depositPercentage: record.depositPercentage ? String(record.depositPercentage) : '',
        internalNotes: record.internalNotes ?? '',
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, record])

  if (!record) return null

  const onSubmit = (values: FormValues) => {
    const now = new Date().toISOString()
    onSave({
      ...record,
      contractNumber: values.contractNumber || undefined,
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
      source: record.source === 'CRAWLED' ? 'CRAWLED_USER_ENRICHED' : record.source,
      updatedAt: now,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Bổ sung thông tin kết quả</DialogTitle>
        </DialogHeader>

        {/* Synced info — read-only */}
        <div className="rounded-lg bg-muted/40 border border-border p-3 space-y-1.5">
          <div className="flex items-center gap-1.5 mb-2">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Thông tin từ Cổng QG (không thể thay đổi)</span>
            <Badge variant="outline" className="text-xs ml-auto">🔒 Đồng bộ</Badge>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Ngày đấu giá</span>
              <p className="font-medium">{(() => { try { return format(new Date(record.auctionDate), 'dd/MM/yyyy') } catch { return record.auctionDate } })()}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Người có tài sản</span>
              <p className="font-medium truncate">{record.ownerName}</p>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground text-xs">Tài sản</span>
              <p className="font-medium leading-snug">{record.assetDescription}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Giá khởi điểm</span>
              <p className="font-medium">{record.startingPrice.toLocaleString('vi-VN')} VND</p>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kết quả đấu giá ★</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="isSuccessful" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Trạng thái</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Chọn..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="true">Thành công</SelectItem>
                        <SelectItem value="false">Không thành</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="winningPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Giá trúng (VND) ★</FormLabel>
                    <FormControl><Input placeholder="5,500,000,000" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="failureReason" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Lý do không thành</FormLabel>
                  <FormControl><Input placeholder="Không có người tham gia" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chi tiết phiên</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="auctionFormat" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Hình thức ★</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Chọn..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(Object.entries(AUCTION_FORMAT_LABELS) as [AuctionFormat, string][]).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="bidStep" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Bước giá (VND) ★</FormLabel>
                    <FormControl><Input placeholder="100,000,000" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="maxRounds" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Số vòng tối đa</FormLabel>
                    <FormControl><Input type="number" min="1" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="actualRounds" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Số vòng thực tế</FormLabel>
                    <FormControl><Input type="number" min="1" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="numberOfParticipants" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Số người tham gia</FormLabel>
                    <FormControl><Input type="number" min="0" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="depositPercentage" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Tiền đặt trước (%)</FormLabel>
                    <FormControl><Input type="number" min="0" max="100" step="0.5" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="contractNumber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Số HĐ dịch vụ</FormLabel>
                    <FormControl><Input placeholder="HĐ-001/2024" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
            </div>

            <Separator />
            <FormField control={form.control} name="internalNotes" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Ghi chú nội bộ</FormLabel>
                <FormControl><Textarea rows={2} placeholder="Ghi chú..." {...field} /></FormControl>
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
              <Button type="submit">Lưu thông tin</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
