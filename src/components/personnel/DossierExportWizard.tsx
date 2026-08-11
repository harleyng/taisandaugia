import { useMemo, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, ArrowLeft, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Auctioneer } from '@/types/auctioneer'
import { POSITION_LABELS } from '@/types/auctioneer'
import {
  DEFAULT_EXPORT_OPTIONS, DEFAULT_SECTIONS, SECTION_HINTS, SECTION_LABELS, SECTION_ORDER,
  TEMPLATE_DESCRIPTIONS, TEMPLATE_LABELS, TEMPLATE_ORDER, TEMPLATE_PAGE_HINT,
  type DossierSectionId, type DossierTemplate,
} from '@/lib/personnel/dossier-templates'
import { DossierTemplateThumb } from './DossierTemplateThumb'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  people: Auctioneer[]
  unitCost: number
  balance: number
  busy: boolean
  onGenerate: (input: {
    people: Auctioneer[]
    template: DossierTemplate
    sections: DossierSectionId[]
  }) => void
}

/** Bước 1 chọn người → bước 2 chọn mẫu trình bày + mục nội dung → Xuất. */
export function DossierExportWizard({
  open, onOpenChange, people, unitCost, balance, busy, onGenerate,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [template, setTemplate] = useState<DossierTemplate>(DEFAULT_EXPORT_OPTIONS.template)
  const [sections, setSections] = useState<DossierSectionId[]>(DEFAULT_EXPORT_OPTIONS.sections)

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
  const noSection = sections.length === 0

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Đổi mẫu là đặt lại bộ mục theo preset của mẫu đó — mỗi mẫu có bộ nội dung
  // hợp với mục đích của nó, giữ nguyên tick cũ sẽ ra bản nửa nọ nửa kia.
  const pickTemplate = (next: DossierTemplate) => {
    setTemplate(next)
    setSections([...DEFAULT_SECTIONS[next]])
  }

  const toggleSection = (id: DossierSectionId) =>
    setSections((prev) =>
      prev.includes(id)
        ? prev.filter((s) => s !== id)
        : SECTION_ORDER.filter((s) => s === id || prev.includes(s)),
    )

  function reset() {
    setStep(1); setSearch(''); setSelected(new Set())
    setTemplate(DEFAULT_EXPORT_OPTIONS.template)
    setSections([...DEFAULT_EXPORT_OPTIONS.sections])
  }

  function handleOpenChange(o: boolean) {
    onOpenChange(o)
    if (!o) reset()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm">
            {step === 1 ? 'Chọn đấu giá viên' : 'Mẫu & nội dung'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === 1
              ? 'Thông tin lấy từ Hồ sơ năng lực — mục Đấu giá viên và Lịch sử đấu giá.'
              : `Sẽ xuất ${chosen.length} hồ sơ PDF theo mẫu ${TEMPLATE_LABELS[template]}. Mỗi hồ sơ là một file riêng.`}
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
            <div className="space-y-2">
              <p className="text-xs font-medium">Mẫu trình bày</p>
              <RadioGroup
                value={template}
                onValueChange={(v) => pickTemplate(v as DossierTemplate)}
                className="grid grid-cols-3 gap-3"
              >
                {TEMPLATE_ORDER.map((k) => (
                  <label
                    key={k}
                    className={cn(
                      'flex flex-col gap-2 rounded-xl border p-2.5 cursor-pointer transition-colors',
                      template === k
                        ? 'border-primary ring-2 ring-primary/25 bg-primary/5'
                        : 'border-border hover:border-primary/40',
                    )}
                  >
                    {/* Ô vuông: trang A4 tỉ lệ dọc nằm gọn giữa ô, có lề trắng như tờ giấy thật. */}
                    <div className="aspect-square rounded-md border bg-white p-1.5 overflow-hidden">
                      <DossierTemplateThumb template={k} />
                    </div>
                    <div className="flex items-start gap-2">
                      <RadioGroupItem value={k} id={`tpl-${k}`} className="mt-0.5" />
                      <div className="min-w-0">
                        <Label htmlFor={`tpl-${k}`} className="text-xs font-medium cursor-pointer">
                          {TEMPLATE_LABELS[k]}
                        </Label>
                        <p className="text-[11px] text-muted-foreground">{TEMPLATE_PAGE_HINT[k]}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground">{TEMPLATE_DESCRIPTIONS[template]}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">
                  Nội dung xuất{' '}
                  <span className="font-normal text-muted-foreground">
                    · {sections.length}/{SECTION_ORDER.length} mục
                  </span>
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setSections(sections.length === SECTION_ORDER.length ? [] : [...SECTION_ORDER])
                  }
                >
                  {sections.length === SECTION_ORDER.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-x-6 rounded-lg border p-3">
                {SECTION_ORDER.map((id) => (
                  <label key={id} className="flex items-start gap-2.5 py-1.5 cursor-pointer">
                    <Checkbox
                      className="mt-0.5"
                      checked={sections.includes(id)}
                      onCheckedChange={() => toggleSection(id)}
                    />
                    <div className="min-w-0">
                      <p className="text-sm leading-tight">{SECTION_LABELS[id]}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{SECTION_HINTS[id]}</p>
                    </div>
                  </label>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Ảnh chân dung, họ tên và số thẻ luôn được in. Đổi mẫu sẽ đặt lại các mục theo mẫu mới.
              </p>
            </div>

            <div className="rounded-lg border bg-secondary/40 p-3 text-sm space-y-1">
              <p>
                Chi phí: <strong>{total} credit</strong> ({unitCost} credit/hồ sơ) · Số dư:{' '}
                <strong>{balance} credit</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Mẫu {TEMPLATE_LABELS[template]} và {sections.length} mục đã chọn áp cho cả{' '}
                {chosen.length} hồ sơ. File được lưu lại — tải về sau không tính phí thêm.
              </p>
              {noSection && (
                <p className="text-xs text-destructive">
                  Chọn ít nhất một mục nội dung để xuất.
                </p>
              )}
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
              disabled={busy || !canAfford || noSection}
              onClick={() => onGenerate({ people: chosen, template, sections })}
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {busy ? 'Đang tạo…' : 'Xuất hồ sơ'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
