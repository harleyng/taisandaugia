import { Plus, Receipt, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { groupNumber, parseNumber } from '@/components/asset-posting/format'
import { FEE_ITEM_PRESETS } from '@/constants/quote-plan'
import { formatVnd } from '@/lib/advertising/slug'
import { DetailCard } from '../detail/DetailCard'
import { feeAmount, feeKeyFor, type FeeRow } from './quoteForm'
import { Hint, Req } from './parts'

interface Props {
  fees: FeeRow[]
  onFees: (fees: FeeRow[]) => void
  commissionPct: string
  onCommissionPct: (v: string) => void
  /** Mức thù lao tối đa chủ tài sản chấp nhận. */
  ownerMaxPct: number | null
  base: number
  totals: { required: number; optional: number; commission: number; total: number }
}

const COLS = 'grid grid-cols-[minmax(9rem,1fr)_6rem_4rem_6.75rem_3.5rem_28px] items-center gap-2 pl-3 pr-2'
const CELL_INPUT = 'h-9 border-transparent bg-transparent hover:border-border focus-visible:bg-card'
const decimal = (v: string) => v.replace(',', '.').replace(/[^\d.]/g, '')

/**
 * "Các khoản chi phí": dòng thù lao (theo % giá khởi điểm) + các khoản tự thêm,
 * mỗi khoản tính bằng VND hoặc %. Khoản tuỳ chọn không cộng vào tổng.
 */
export function QuoteFeesCard({ fees, onFees, commissionPct, onCommissionPct, ownerMaxPct, base, totals }: Props) {
  const patch = (i: number, next: Partial<FeeRow>) => onFees(fees.map((f, j) => (j === i ? { ...f, ...next } : f)))

  return (
    <DetailCard
      icon={Receipt}
      title={
        <>
          Các khoản chi phí <Req />
        </>
      }
      aside={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onFees([...fees, { key: 'khac', label: '', unit: 'vnd', value: '', optional: false }])}
        >
          <Plus className="h-4 w-4" /> Thêm khoản
        </Button>
      }
    >
      <div className="overflow-x-auto rounded-xl border border-border">
        <div className="min-w-[34rem]">
          <div
            className={cn(
              COLS,
              'border-b border-border bg-muted/50 py-2 pl-6 text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground',
            )}
          >
            <span>Khoản mục</span>
            <span className="pr-3 text-right">Giá trị</span>
            <span className="pl-2.5">Đơn vị</span>
            <span className="text-right">Thành tiền</span>
            <span className="text-center text-[10.5px] tracking-normal">Tuỳ chọn</span>
            <span />
          </div>

          <div className={cn(COLS, 'bg-primary/[0.03] py-2')}>
            <div className="flex min-w-0 flex-col pl-3">
              <b className="text-sm font-medium">
                Thù lao đấu giá <Req />
              </b>
              <small className="text-xs text-muted-foreground">
                Theo giá khởi điểm{ownerMaxPct != null ? ` · chủ TS chấp nhận ≤ ${ownerMaxPct}%` : ''}
              </small>
            </div>
            <Input
              id="q-commission"
              inputMode="decimal"
              placeholder="2"
              aria-label="Thù lao (%)"
              className="h-9 bg-card text-right tabular-nums"
              value={commissionPct}
              onChange={(e) => onCommissionPct(decimal(e.target.value))}
            />
            <span className="pl-2.5 text-[13px] text-muted-foreground">%</span>
            <span className="text-right text-sm font-medium tabular-nums">
              {totals.commission ? formatVnd(totals.commission) : '—'}
            </span>
            <span />
            <span />
          </div>

          {fees.map((f, i) => {
            const amount = feeAmount(f, base)
            return (
              <div key={i} className={cn(COLS, 'border-t border-border py-2', f.optional && 'text-muted-foreground')}>
                <Input
                  list="quote-fee-presets"
                  aria-label="Tên khoản mục"
                  placeholder="Tên khoản mục"
                  className={CELL_INPUT}
                  value={f.label}
                  onChange={(e) => patch(i, { label: e.target.value, key: feeKeyFor(e.target.value) })}
                />
                <Input
                  inputMode={f.unit === '%' ? 'decimal' : 'numeric'}
                  aria-label="Giá trị"
                  placeholder="0"
                  className={cn(CELL_INPUT, 'text-right tabular-nums')}
                  value={f.unit === '%' ? f.value : groupNumber(f.value)}
                  onChange={(e) =>
                    patch(i, { value: f.unit === '%' ? decimal(e.target.value) : parseNumber(e.target.value) })
                  }
                />
                <Select value={f.unit} onValueChange={(v) => patch(i, { unit: v as FeeRow['unit'], value: '' })}>
                  <SelectTrigger aria-label="Đơn vị" className={cn(CELL_INPUT, 'px-2 text-[13px]')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vnd">VND</SelectItem>
                    <SelectItem value="%">%</SelectItem>
                  </SelectContent>
                </Select>
                <span
                  className={cn(
                    'text-right text-sm font-medium tabular-nums',
                    f.optional && 'text-muted-foreground line-through decoration-muted-foreground/50',
                  )}
                >
                  {amount ? formatVnd(amount) : '—'}
                </span>
                <div className="flex justify-center" title="Khoản tuỳ chọn — không tính vào tổng">
                  <Switch
                    aria-label="Tuỳ chọn"
                    className="h-[18px] w-8 [&>span]:h-3.5 [&>span]:w-3.5 [&>span[data-state=checked]]:translate-x-3.5"
                    checked={f.optional}
                    onCheckedChange={(v) => patch(i, { optional: v })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Xoá khoản"
                  className="h-7 w-7 text-destructive hover:bg-destructive/[0.08] hover:text-destructive"
                  onClick={() => onFees(fees.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )
          })}

          <div className="flex items-baseline justify-between border-t border-border bg-muted/50 py-3 pl-3 pr-4 text-sm text-muted-foreground">
            <span>Tổng chi phí</span>
            <b className="text-base font-semibold tabular-nums text-foreground">{formatVnd(totals.total)}</b>
          </div>
        </div>
      </div>
      <datalist id="quote-fee-presets">
        {FEE_ITEM_PRESETS.filter((p) => p.key !== 'khac').map((p) => (
          <option key={p.key} value={p.label} />
        ))}
      </datalist>
      <Hint>
        {totals.optional > 0 &&
          `Khoản tuỳ chọn (${formatVnd(totals.optional)}) không tính vào tổng — chủ tài sản chọn thêm nếu cần. `}
        Thù lao tạm tính theo giá khởi điểm; thực thu theo giá trúng đấu giá.
      </Hint>
    </DetailCard>
  )
}
