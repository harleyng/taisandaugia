import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, PenLine, RefreshCw, CheckCircle2, XCircle } from 'lucide-react'
import type { CrawlState } from '@/hooks/useAuctioneers'
import type { CrawledAuctioneer } from '@/lib/auctioneers/merge'
import { computeYearsOfExperience } from '@/types/auctioneer'

interface Props {
  crawlState: CrawlState
  crawlPreview: CrawledAuctioneer[]
  taxCode: string
  onSaveTaxCode: (code: string) => void
  onCrawl: (taxCode: string) => void
  onAccept: (selected: CrawledAuctioneer[]) => void
  onDismiss: () => void
  onAddManual: () => void
}

export function AuctioneerOnboarding({
  crawlState,
  crawlPreview,
  taxCode,
  onSaveTaxCode,
  onCrawl,
  onAccept,
  onDismiss,
  onAddManual,
}: Props) {
  const [localTaxCode, setLocalTaxCode] = useState(taxCode)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [taxCodeStep, setTaxCodeStep] = useState(!taxCode)

  const handleCrawl = () => {
    const code = localTaxCode.trim()
    if (!code) return
    onSaveTaxCode(code)
    setTaxCodeStep(false)
    onCrawl(code)
  }

  const toggleSelect = (licenseNumber: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(licenseNumber)) next.delete(licenseNumber)
      else next.add(licenseNumber)
      return next
    })
  }

  const selectAll = () => setSelected(new Set(crawlPreview.map((a) => a.licenseNumber)))
  const deselectAll = () => setSelected(new Set())

  const handleAccept = () => {
    const picked = crawlPreview.filter((a) => selected.has(a.licenseNumber))
    onAccept(picked)
  }

  // ── Preview state ──
  if (crawlState === 'preview') {
    return (
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <h2 className="text-sm font-semibold">Tìm thấy {crawlPreview.length} đấu giá viên</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Bỏ chọn những người không thuộc công ty trước khi thêm vào hệ thống.
        </p>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {crawlPreview.map((a) => {
            const years = computeYearsOfExperience(a.licenseIssuedDate)
            return (
              <label
                key={a.licenseNumber}
                className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30"
              >
                <Checkbox
                  checked={selected.has(a.licenseNumber)}
                  onCheckedChange={() => toggleSelect(a.licenseNumber)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    Thẻ {a.licenseNumber} · {years} năm KN
                  </p>
                </div>
              </label>
            )
          })}
        </div>
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={selectAll}>Chọn tất cả</Button>
            <Button variant="ghost" size="sm" onClick={deselectAll}>Bỏ chọn</Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onDismiss}>Huỷ</Button>
            <Button size="sm" onClick={handleAccept} disabled={selected.size === 0}>
              Thêm {selected.size > 0 ? selected.size : ''} người vào hệ thống
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  // ── No data state ──
  if (crawlState === 'no_data') {
    return (
      <Card className="p-8 text-center space-y-4">
        <XCircle className="h-10 w-10 text-muted-foreground mx-auto" />
        <div>
          <h2 className="text-sm font-semibold">Chưa có dữ liệu công khai</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Cổng đấu giá tài sản quốc gia chưa có thông tin ĐGV của công ty bạn.
            Có thể do Sở Tư pháp địa phương chưa cập nhật, hoặc công ty mới thành lập.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={onAddManual} className="gap-1.5">
            <PenLine className="h-4 w-4" />
            Nhập thủ công từng người
          </Button>
          <Button variant="outline" onClick={onDismiss} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Thử lại sau
          </Button>
        </div>
      </Card>
    )
  }

  // ── Bot protection state ──
  if (crawlState === 'bot_protection') {
    return (
      <Card className="p-8 text-center space-y-4">
        <XCircle className="h-10 w-10 text-warning mx-auto" />
        <div>
          <h2 className="text-sm font-semibold">Cổng QG yêu cầu xác thực</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Hệ thống tự động tạm thời bị chặn. Bạn có thể nhập thủ công hoặc thử lại sau vài phút.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={onAddManual} className="gap-1.5">
            <PenLine className="h-4 w-4" />
            Nhập thủ công
          </Button>
          <Button variant="outline" onClick={() => onCrawl(taxCode)} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </Button>
        </div>
      </Card>
    )
  }

  // ── Error state ──
  if (crawlState === 'error') {
    return (
      <Card className="p-8 text-center space-y-4">
        <XCircle className="h-10 w-10 text-destructive mx-auto" />
        <div>
          <h2 className="text-sm font-semibold">Không thể kết nối Cổng QG</h2>
          <p className="text-sm text-muted-foreground mt-1">Vui lòng kiểm tra kết nối mạng và thử lại.</p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button onClick={onAddManual} variant="outline" className="gap-1.5">
            <PenLine className="h-4 w-4" />
            Nhập thủ công
          </Button>
          <Button onClick={() => onCrawl(taxCode)} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </Button>
        </div>
      </Card>
    )
  }

  // ── Idle / initial state ──
  return (
    <Card className="p-8 text-center space-y-4 max-w-lg mx-auto">
      <Search className="h-10 w-10 text-primary mx-auto" />
      <div>
        <h2 className="text-base font-semibold">Đầy đủ ĐGV chỉ trong 30 giây</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Chúng tôi sẽ tìm trên Cổng đấu giá tài sản quốc gia (Bộ Tư pháp) theo MST công ty bạn.
        </p>
      </div>

      {taxCodeStep ? (
        <div className="text-left space-y-2 mx-auto max-w-xs">
          <Label htmlFor="tax-code" className="text-sm">Mã số thuế (MST) công ty</Label>
          <div className="flex gap-2">
            <Input
              id="tax-code"
              value={localTaxCode}
              onChange={(e) => setLocalTaxCode(e.target.value)}
              placeholder="0123456789"
              className="font-mono"
              onKeyDown={(e) => e.key === 'Enter' && handleCrawl()}
            />
            <Button onClick={handleCrawl} disabled={!localTaxCode.trim()}>
              Tìm
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => setTaxCodeStep(true)}
            className="gap-1.5 mx-auto"
            disabled={crawlState === 'loading'}
          >
            <Search className="h-4 w-4" />
            {crawlState === 'loading' ? 'Đang tìm...' : 'Tự động tìm (Miễn phí lần đầu)'}
          </Button>
          <Button variant="ghost" onClick={onAddManual} className="gap-1.5 mx-auto text-muted-foreground">
            <PenLine className="h-4 w-4" />
            Tôi muốn nhập thủ công
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Một số công ty chưa public dữ liệu trên cổng. Bạn vẫn có thể nhập thủ công sau.
      </p>
    </Card>
  )
}
