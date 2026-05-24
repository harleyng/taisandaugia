import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { ChevronRight, SkipForward, Zap } from 'lucide-react'
import type { AuctionRecord } from '@/types/auction-record'
import { AUCTION_FORMAT_LABELS, type AuctionFormat } from '@/types/auction-record'
import { format } from 'date-fns'

interface Props {
  records: AuctionRecord[]
  currentIndex: number
  onSave: (record: AuctionRecord) => void
  onSkip: () => void
}

export function QuickFillForm({ records, currentIndex, onSave, onSkip }: Props) {
  const record = records[currentIndex]
  const [winningPrice, setWinningPrice] = useState('')
  const [isSuccessful, setIsSuccessful] = useState<string>('')
  const [auctionFormat, setAuctionFormat] = useState<AuctionFormat | ''>('')
  const [bidStep, setBidStep] = useState('')
  const [actualRounds, setActualRounds] = useState('')

  if (!record) return null

  const parseVND = (s: string) => {
    const n = Number(s.replace(/[,.\s]/g, ''))
    return isNaN(n) ? undefined : n
  }

  const handleSave = () => {
    const updated: AuctionRecord = {
      ...record,
      winningPrice: parseVND(winningPrice),
      isSuccessful: isSuccessful === 'true' ? true : isSuccessful === 'false' ? false : record.isSuccessful,
      auctionFormat: auctionFormat || record.auctionFormat,
      bidStep: parseVND(bidStep),
      actualRounds: actualRounds ? Number(actualRounds) : record.actualRounds,
      updatedAt: new Date().toISOString(),
    }
    onSave(updated)
    setWinningPrice('')
    setIsSuccessful('')
    setAuctionFormat('')
    setBidStep('')
    setActualRounds('')
  }

  const progress = Math.round((currentIndex / records.length) * 100)
  const startingPriceFmt = record.startingPrice.toLocaleString('vi-VN')
  const needsWinningPrice = record.winningPrice === undefined
  const needsFormat = record.auctionFormat === undefined
  const needsBidStep = record.bidStep === undefined

  return (
    <Card className="p-5 border-amber-200 bg-amber-50/30">
      <div className="flex items-start gap-3 mb-4">
        <div className="p-1.5 rounded-lg bg-amber-100 shrink-0">
          <Zap className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{format(new Date(record.auctionDate), 'dd/MM/yyyy')} · {record.ownerName}</p>
          <p className="text-sm font-medium truncate">{record.assetDescription}</p>
          <p className="text-xs text-muted-foreground">Giá KĐ: {startingPriceFmt} VND</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Trạng thái cuộc đấu giá</Label>
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

        {needsWinningPrice && (
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
        )}

        {needsFormat && (
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
        )}

        {needsBidStep && (
          <div>
            <Label className="text-xs">Bước giá (VND)</Label>
            <Input
              className="mt-1 h-8 text-sm"
              placeholder="100,000,000"
              value={bidStep}
              onChange={(e) => setBidStep(e.target.value)}
            />
          </div>
        )}

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

      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-amber-200">
        <div className="flex-1">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Tiến độ bổ sung</span>
            <span>{currentIndex + 1}/{records.length}</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
        <Button variant="ghost" size="sm" onClick={onSkip} className="gap-1.5 text-muted-foreground shrink-0">
          <SkipForward className="h-3.5 w-3.5" />Bỏ qua
        </Button>
        <Button size="sm" onClick={handleSave} className="gap-1.5 shrink-0">
          Lưu & tiếp <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        💡 Nhập giá trúng sẽ tự động tính chênh lệch và cập nhật điểm Mục IV.3-4
      </p>
    </Card>
  )
}
