import { useMemo, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, ArrowLeft, Loader2 } from 'lucide-react'
import type { Auctioneer } from '@/types/auctioneer'
import { POSITION_LABELS } from '@/types/auctioneer'
import { TEMPLATE_LABELS, TEMPLATE_DESCRIPTIONS } from '@/lib/personnel/dossier-content'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  people: Auctioneer[]
  unitCost: number
  balance: number
  busy: boolean
  onGenerate: (input: { people: Auctioneer[] }) => void
}

/** Bước 1 chọn người → bước 2 chọn template + định dạng → Generate. */
export function DossierExportWizard({
  open, onOpenChange, people, unitCost, balance, busy, onGenerate,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return people
    return people.filter(
      (a) => a.fullName.toLowerCase().includes(q) || a.licenseNumber.toLowerCase().includes(q),
    )
  }, [people, search])

  const chosen = useMemo(() => people.filter((a) => selected.has(a.id)), [people, selected])
  const total = unitCost * chosen.length
  const canAfford = balance >= total

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  function reset() {
    setStep(1); setSearch(''); setSelected(new Set())
  }

  function handleOpenChange(o: boolean) {
    onOpenChange(o)
    if (!o) reset()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {step === 1 ? 'Chọn đấu giá viên' : 'Xác nhận xuất hồ sơ'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === 1
              ? 'Thông tin lấy từ Hồ sơ năng lực — mục Đấu giá viên và Lịch sử đấu giá.'
              : `Sẽ xuất ${chosen.length} hồ sơ PDF. Mỗi hồ sơ là một file riêng.`}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Tìm theo họ tên hoặc số thẻ ĐGV…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Đã chọn {selected.size}/{people.length}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelected(
                    selected.size === filtered.length
                      ? new Set()
                      : new Set(filtered.map((a) => a.id)),
                  )
                }
              >
                {selected.size === filtered.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </Button>
            </div>

            <ScrollArea className="max-h-72">
              <div className="divide-y rounded-lg border">
                {filtered.map((a) => (
                  <label key={a.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer">
                    <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggle(a.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {POSITION_LABELS[a.position]} · Thẻ {a.licenseNumber}
                      </p>
                    </div>
                  </label>
                ))}
                {filtered.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Không tìm thấy ai khớp “{search}”.
                  </p>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">{TEMPLATE_LABELS.FULL}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {TEMPLATE_DESCRIPTIONS.FULL}
              </p>
            </div>

            <div className="rounded-lg border bg-secondary/40 p-3 text-sm space-y-1">
              <p>
                Chi phí: <strong>{total} credit</strong> ({unitCost} credit/hồ sơ) · Số dư:{' '}
                <strong>{balance} credit</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                File được lưu lại — tải về sau không tính phí thêm.
              </p>
              {!canAfford && (
                <p className="text-xs text-destructive">
                  Số dư không đủ. Cần thêm {total - balance} credit.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button variant="outline" size="sm" className="gap-1.5 mr-auto" disabled={busy}
              onClick={() => setStep(1)}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Quay lại
            </Button>
          )}
          <Button variant="outline" size="sm" disabled={busy} onClick={() => handleOpenChange(false)}>
            Hủy
          </Button>
          {step === 1 ? (
            <Button size="sm" disabled={selected.size === 0} onClick={() => setStep(2)}>
              Tiếp tục ({selected.size})
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-1.5"
              disabled={busy || !canAfford}
              onClick={() => onGenerate({ people: chosen })}
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {busy ? 'Đang tạo…' : 'Generate'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
