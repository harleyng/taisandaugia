import { useState, useEffect } from 'react'
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
import { ChevronLeft, ChevronRight, SkipForward, Zap } from 'lucide-react'
import type { AuctionRecord, AssetResult } from '@/types/auction-record'
import { AUCTION_FORMAT_LABELS, BIDDING_METHOD_LABELS, type AuctionFormat, type BiddingMethod } from '@/types/auction-record'
import type { AuctionAsset } from '@/components/auction/AuctionAssetCard'
import { useAuctioneers } from '@/hooks/useAuctioneers'
import { format } from 'date-fns'

const assetResultSchema = z.object({
  winningPrice: z.string().optional(),
  isSuccessful: z.string().optional(),
  failureReason: z.string().optional(),
})

const schema = z.object({
  contractNumber: z.string().optional(),
  auctioneer: z.string().optional(),
  winningPrice: z.string().optional(),
  isSuccessful: z.string().optional(),
  failureReason: z.string().optional(),
  auctionFormat: z.string().optional(),
  biddingMethod: z.string().optional(),
  bidStep: z.string().optional(),
  maxRounds: z.string().optional(),
  actualRounds: z.string().optional(),
  numberOfParticipants: z.string().optional(),
  depositPercentage: z.string().optional(),
  internalNotes: z.string().optional(),
  assetFields: z.array(assetResultSchema).optional(),
})

type FormValues = z.infer<typeof schema>

const parseNum = (s?: string) => {
  if (!s) return undefined
  const n = Number(s.replace(/[,.\s]/g, ''))
  return isNaN(n) ? undefined : n
}

interface RecordFormProps {
  record: AuctionRecord
  rawListings?: Record<string, Record<string, unknown>>
  onSave: (record: AuctionRecord) => void
  onSkip: () => void
  onClose: () => void
  isBatch: boolean
}

function RecordForm({ record, rawListings, onSave, onSkip, onClose, isBatch }: RecordFormProps) {
  const { auctioneers } = useAuctioneers()
  const activeAuctioneers = auctioneers.filter((a) => a.isActive)

  const ca = (rawListings?.[record.id]?.custom_attributes ?? {}) as Record<string, unknown>
  const assets: AuctionAsset[] = Array.isArray(ca.assets) && (ca.assets as unknown[]).length > 0
    ? (ca.assets as AuctionAsset[])
    : []
  const isMultiAsset = assets.length > 1

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      contractNumber: record.contractNumber ?? '',
      auctioneer: record.auctioneer ?? '',
      winningPrice: record.winningPrice ? record.winningPrice.toLocaleString('vi-VN') : '',
      isSuccessful: record.isSuccessful === true ? 'true' : record.isSuccessful === false ? 'false' : '',
      failureReason: record.failureReason ?? '',
      auctionFormat: record.auctionFormat ?? '',
      biddingMethod: record.biddingMethod ?? '',
      bidStep: record.bidStep ? record.bidStep.toLocaleString('vi-VN') : '',
      maxRounds: record.maxRounds ? String(record.maxRounds) : '',
      actualRounds: record.actualRounds ? String(record.actualRounds) : '',
      numberOfParticipants: record.numberOfParticipants ? String(record.numberOfParticipants) : '',
      depositPercentage: record.depositPercentage ? String(record.depositPercentage) : '',
      internalNotes: record.internalNotes ?? '',
      assetFields: isMultiAsset
        ? assets.map((_, i) => ({
            winningPrice: record.assetResults?.[i]?.winning_price
              ? record.assetResults[i].winning_price!.toLocaleString('vi-VN')
              : '',
            isSuccessful: record.assetResults?.[i]?.isSuccessful === true ? 'true'
              : record.assetResults?.[i]?.isSuccessful === false ? 'false' : '',
            failureReason: record.assetResults?.[i]?.failureReason ?? '',
          }))
        : [],
    },
  })

  const onSubmit = (values: FormValues) => {
    const now = new Date().toISOString()

    let assetResults: AssetResult[] | undefined
    let aggregateWinningPrice: number | undefined
    let aggregateIsSuccessful: boolean | undefined

    if (isMultiAsset && values.assetFields && values.assetFields.length > 0) {
      assetResults = values.assetFields.map((f) => ({
        winning_price: parseNum(f.winningPrice),
        isSuccessful: f.isSuccessful === 'true' ? true : f.isSuccessful === 'false' ? false : undefined,
        failureReason: f.failureReason || undefined,
      }))
      const successfulWithPrice = assetResults.filter(
        (r) => r.winning_price !== undefined && r.isSuccessful !== false,
      )
      aggregateWinningPrice = successfulWithPrice.length > 0
        ? successfulWithPrice.reduce((s, r) => s + (r.winning_price ?? 0), 0)
        : undefined
      aggregateIsSuccessful = assetResults.some((r) => r.isSuccessful === true) ? true : undefined
    }

    onSave({
      ...record,
      contractNumber: values.contractNumber || undefined,
      auctioneer: values.auctioneer || undefined,
      winningPrice: isMultiAsset ? aggregateWinningPrice : parseNum(values.winningPrice),
      isSuccessful: isMultiAsset
        ? aggregateIsSuccessful
        : values.isSuccessful === 'true' ? true : values.isSuccessful === 'false' ? false : undefined,
      failureReason: isMultiAsset ? undefined : (values.failureReason || undefined),
      assetResults: isMultiAsset ? assetResults : undefined,
      auctionFormat: (values.auctionFormat as AuctionFormat) || undefined,
      biddingMethod: (values.biddingMethod as BiddingMethod) || undefined,
      bidStep: parseNum(values.bidStep),
      maxRounds: values.maxRounds ? Number(values.maxRounds) : undefined,
      actualRounds: values.actualRounds ? Number(values.actualRounds) : undefined,
      numberOfParticipants: values.numberOfParticipants ? Number(values.numberOfParticipants) : undefined,
      depositPercentage: values.depositPercentage ? Number(values.depositPercentage) : undefined,
      internalNotes: values.internalNotes || undefined,
      source: record.source === 'CRAWLED' ? 'CRAWLED_USER_ENRICHED' : record.source,
      updatedAt: now,
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Record context */}
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">
            {(() => { try { return format(new Date(record.auctionDate), 'dd/MM/yyyy') } catch { return record.auctionDate } })()} · {record.ownerName}
          </p>
          <p className="text-sm font-medium leading-snug mt-0.5">{record.assetDescription}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Giá KĐ: {record.startingPrice.toLocaleString('vi-VN')} VND
            {isMultiAsset && <span className="ml-2 text-primary font-medium">· {assets.length} tài sản</span>}
          </p>
        </div>

        {/* Auction result */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kết quả đấu giá ★</p>

          {isMultiAsset ? (
            <div className="space-y-2">
              {assets.map((asset, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    #{i + 1} · {(asset as AuctionAsset).title || `Tài sản ${i + 1}`}
                    {(asset as AuctionAsset).starting_price && (
                      <span className="ml-1">· KĐ {((asset as AuctionAsset).starting_price! / 1_000_000).toFixed(0)}tr</span>
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <FormField
                      control={form.control}
                      name={`assetFields.${i}.isSuccessful`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Trạng thái</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Chọn..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="true">Thành công</SelectItem>
                              <SelectItem value="false">Không thành</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`assetFields.${i}.winningPrice`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Giá trúng (VND) ★</FormLabel>
                          <FormControl>
                            <Input className="h-8 text-xs" placeholder="5,500,000,000" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name={`assetFields.${i}.failureReason`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Lý do không thành</FormLabel>
                        <FormControl>
                          <Input className="h-8 text-xs" placeholder="Không có người tham gia" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>

        <Separator />

        {/* Session details */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chi tiết phiên</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="auctionFormat" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Hình thức đấu giá ★</FormLabel>
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
            <FormField control={form.control} name="biddingMethod" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Phương thức đấu giá ★</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Chọn..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {(Object.entries(BIDDING_METHOD_LABELS) as [BiddingMethod, string][]).map(([k, v]) => (
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
          <FormField control={form.control} name="auctioneer" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Đấu giá viên phụ trách</FormLabel>
              {activeAuctioneers.length > 0 ? (
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Chọn đấu giá viên..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {activeAuctioneers.map((a) => (
                      <SelectItem key={a.id} value={a.fullName}>{a.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground py-1">
                  Chưa có đấu giá viên — thêm tại mục Đấu giá viên
                </p>
              )}
            </FormItem>
          )} />
        </div>

        <Separator />

        <FormField control={form.control} name="internalNotes" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Ghi chú nội bộ</FormLabel>
            <FormControl><Textarea rows={2} placeholder="Ghi chú..." {...field} /></FormControl>
          </FormItem>
        )} />

        <DialogFooter className="flex-row gap-2">
          {isBatch ? (
            <Button type="button" variant="ghost" size="sm" onClick={onSkip} className="gap-1.5 text-muted-foreground mr-auto">
              <SkipForward className="h-3.5 w-3.5" />Bỏ qua
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={onClose}>Huỷ</Button>
          )}
          <Button type="submit">Lưu thông tin</Button>
        </DialogFooter>
      </form>
    </Form>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  records: AuctionRecord[]
  initialIndex: number
  onSave: (record: AuctionRecord) => void
  rawListings?: Record<string, Record<string, unknown>>
}

export function AuctionRecordDialog({ open, onClose, records, initialIndex, onSave, rawListings }: Props) {
  const [index, setIndex] = useState(initialIndex)

  useEffect(() => {
    if (open) setIndex(initialIndex)
  }, [initialIndex, open])

  const record = records[index]
  if (!record) return null

  const isBatch = records.length > 1
  const hasPrev = index > 0
  const hasNext = index < records.length - 1

  const handleSave = (saved: AuctionRecord) => {
    onSave(saved)
    if (hasNext) setIndex((i) => i + 1)
    else onClose()
  }

  const handleSkip = () => {
    if (hasNext) setIndex((i) => i + 1)
    else onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base">
              {isBatch && (
                <div className="p-1 rounded bg-amber-100 shrink-0">
                  <Zap className="h-4 w-4 text-amber-600" />
                </div>
              )}
              {isBatch ? 'Bổ sung kết quả' : 'Chỉnh sửa thông tin'}
            </DialogTitle>
            {isBatch && (
              <div className="flex items-center gap-1 mr-6">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!hasPrev} onClick={() => setIndex((i) => i - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">
                  {index + 1}/{records.length}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!hasNext} onClick={() => setIndex((i) => i + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <RecordForm
          key={record.id}
          record={record}
          rawListings={rawListings}
          onSave={handleSave}
          onSkip={handleSkip}
          onClose={onClose}
          isBatch={isBatch}
        />
      </DialogContent>
    </Dialog>
  )
}
