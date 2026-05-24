import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronLeft, ChevronRight, SkipForward, Zap } from 'lucide-react'
import type { AuctionRecord } from '@/types/auction-record'
import { AUCTION_FORMAT_LABELS, BIDDING_METHOD_LABELS, type AuctionFormat, type BiddingMethod } from '@/types/auction-record'
import { format } from 'date-fns'

interface FillFormProps {
  record: AuctionRecord
  onSave: (record: AuctionRecord) => void
  onSkip: () => void
}

function FillForm({ record, onSave, onSkip }: FillFormProps) {
  const [winningPrice, setWinningPrice] = useState('')
  const [isSuccessful, setIsSuccessful] = useState('')
  const [auctionFormat, setAuctionFormat] = useState<AuctionFormat | ''>('')
  const [biddingMethod, setBiddingMethod] = useState<BiddingMethod | ''>('')
  const [bidStep, setBidStep] = useState('')
  const [actualRounds, setActualRounds] = useState('')

  const parseVND = (s: string) => {
    const n = Number(s.replace(/[,.\s]/g, ''))
    return isNaN(n) ? undefined : n
  }

  const handleSave = () => {
    const updated: AuctionRecord = {
      ...record,
      winningPrice: parseVND(winningPrice) ?? record.winningPrice,
      isSuccessful: isSuccessful === 'true' ? true : isSuccessful === 'false' ? false : record.isSuccessful,
      auctionFormat: (auctionFormat as AuctionFormat) || record.auctionFormat,
      biddingMethod: (biddingMethod as BiddingMethod) || record.biddingMethod,
      bidStep: parseVND(bidStep) ?? record.bidStep,
      actualRounds: actualRounds ? Number(actualRounds) : record.actualRounds,
      updatedAt: new Date().toISOString(),
    }
    onSave(updated)
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
        <p className="text-xs text-muted-foreground">
          {format(new Date(record.auctionDate), 'dd/MM/yyyy')} · {record.ownerName}
        </p>
        <p className="text-sm font-medium leading-snug mt-0.5">{record.assetDescription}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Giá KĐ: {record.startingPrice.toLocaleString('vi-VN')} VND
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Trạng thái</Label>
          <Select value={isSuccessful} onValueChange={setIsSuccessful}>
            <SelectTrigger className="mt-1 h-8 text-sm">
              <SelectValue placeholder="Chọn..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Thành công</SelectItem>
              <SelectItem value="false">Không thành</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Giá trúng (VND) ★</Label>
          <Input
            className="mt-1 h-8 text-sm"
            placeholder="5,000,000,000"
            value={winningPrice}
            onChange={(e) => setWinningPrice(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <Label className="text-xs">Hình thức đấu giá</Label>
          <Select value={auctionFormat} onValueChange={(v) => setAuctionFormat(v as AuctionFormat)}>
            <SelectTrigger className="mt-1 h-8 text-sm">
              <SelectValue placeholder="Chọn..." />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(AUCTION_FORMAT_LABELS) as [AuctionFormat, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Phương thức đấu giá</Label>
          <Select value={biddingMethod} onValueChange={(v) => setBiddingMethod(v as BiddingMethod)}>
            <SelectTrigger className="mt-1 h-8 text-sm">
              <SelectValue placeholder="Chọn..." />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(BIDDING_METHOD_LABELS) as [BiddingMethod, string][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Bước giá (VND)</Label>
          <Input
            className="mt-1 h-8 text-sm"
            placeholder="100,000,000"
            value={bidStep}
            onChange={(e) => setBidStep(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs">Số vòng thực tế</Label>
          <Input
            className="mt-1 h-8 text-sm"
            placeholder="3"
            value={actualRounds}
            onChange={(e) => setActualRounds(e.target.value)}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        💡 Nhập giá trúng sẽ tự động tính chênh lệch và cập nhật điểm Mục IV.3-4
      </p>

      <div className="flex justify-between pt-1 border-t border-border">
        <Button variant="ghost" size="sm" onClick={onSkip} className="gap-1.5 text-muted-foreground">
          <SkipForward className="h-3.5 w-3.5" />Bỏ qua
        </Button>
        <Button size="sm" onClick={handleSave} className="gap-1.5">
          Lưu <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  records: AuctionRecord[]
  initialIndex: number
  onSave: (record: AuctionRecord) => void
}

export function QuickFillDialog({ open, onClose, records, initialIndex, onSave }: Props) {
  const [index, setIndex] = useState(initialIndex)

  useEffect(() => {
    if (open) setIndex(initialIndex)
  }, [initialIndex, open])

  const record = records[index]
  if (!record) return null

  const total = records.length
  const hasPrev = index > 0
  const hasNext = index < total - 1

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="p-1 rounded bg-amber-100 shrink-0">
                <Zap className="h-4 w-4 text-amber-600" />
              </div>
              Bổ sung kết quả
            </DialogTitle>
            <div className="flex items-center gap-1 mr-6">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!hasPrev}
                onClick={() => setIndex((i) => i - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums w-10 text-center">
                {index + 1}/{total}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!hasNext}
                onClick={() => setIndex((i) => i + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <FillForm key={record.id} record={record} onSave={handleSave} onSkip={handleSkip} />
      </DialogContent>
    </Dialog>
  )
}
