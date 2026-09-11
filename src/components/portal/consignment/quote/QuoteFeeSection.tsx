import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { groupNumber, parseNumber, vnWords } from '@/components/asset-posting/format'
import { FEE_ITEM_PRESETS } from '@/constants/quote-plan'
import { feeTotal, feeTotalRequired } from '@/lib/quotePlan'
import { formatVnd } from '@/lib/advertising/slug'
import type { OrgServiceRequest, QuoteFeeItem } from '@/types/consignment'

interface Props {
  items: QuoteFeeItem[]
  onChange: (items: QuoteFeeItem[]) => void
  commissionPct: string
  onCommissionChange: (v: string) => void
  startingPrice: string
  onStartingPriceChange: (v: string) => void
  request: OrgServiceRequest | null
}

const PRESET_LABEL: Record<string, string> = Object.fromEntries(FEE_ITEM_PRESETS.map((p) => [p.key, p.label]))

/**
 * B. Chi phí theo khoản mục.
 *
 * Chỉ các khoản BẮT BUỘC cộng vào tổng — đó là con số server ghi vào
 * quote_service_fee và sau này thành opportunities.gross_amount. Khoản tuỳ chọn
 * là lựa chọn thêm của chủ tài sản nên không được làm phồng con số so sánh.
 */
export function QuoteFeeSection({
  items, onChange, commissionPct, onCommissionChange, startingPrice, onStartingPriceChange, request,
}: Props) {
  const required = feeTotalRequired(items)
  const all = feeTotal(items)
  const hasOptional = all !== required

  const patch = (index: number, next: Partial<QuoteFeeItem>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...next } : item)))

  const addItem = () =>
    onChange([...items, { key: 'khac', label: '', amount: 0, optional: false }])

  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="q-commission">Thù lao (%)</Label>
          <Input
            id="q-commission"
            inputMode="decimal"
            placeholder="2"
            value={commissionPct}
            onChange={(e) => onCommissionChange(e.target.value.replace(/[^\d.]/g, ''))}
          />
          {request?.commission_pct != null && (
            <p className="text-xs text-muted-foreground">Chủ tài sản chấp nhận tới {request.commission_pct}%</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="q-price">Giá khởi điểm đề xuất (VNĐ)</Label>
          <Input
            id="q-price"
            inputMode="numeric"
            placeholder="0"
            value={groupNumber(startingPrice)}
            onChange={(e) => onStartingPriceChange(parseNumber(e.target.value))}
          />
          {/* Hồ sơ "nhờ định giá" không có giá — đây là chỗ tổ chức đề xuất. */}
          <p className="text-xs text-muted-foreground">
            {request?.pricing_mode === 'appraisal'
              ? 'Chủ tài sản nhờ tổ chức định giá'
              : startingPrice
                ? vnWords(startingPrice)
                : 'Để trống nếu giữ giá chủ tài sản đưa ra'}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Các khoản chi phí</Label>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addItem}>
            <Plus className="h-3.5 w-3.5" />
            Thêm khoản
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Chưa có khoản chi phí nào. Thêm từng khoản để chủ tài sản thấy rõ tiền đi đâu.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="rounded-xl border border-border p-3 space-y-2.5">
                <div className="flex gap-2">
                  <Select
                    value={item.key}
                    onValueChange={(v) =>
                      patch(i, {
                        key: v,
                        // Chọn preset thì điền luôn nhãn, trừ "khác" — chỗ đó tổ chức tự gõ.
                        label: v === 'khac' ? '' : (PRESET_LABEL[v] ?? item.label),
                      })
                    }
                  >
                    <SelectTrigger className="w-44 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FEE_ITEM_PRESETS.map((p) => (
                        <SelectItem key={p.key} value={p.key}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    aria-label={`Tên khoản chi phí ${i + 1}`}
                    placeholder="Tên khoản mục"
                    value={item.label}
                    onChange={(e) => patch(i, { label: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    aria-label={`Xoá khoản ${item.label || i + 1}`}
                    className="shrink-0 rounded-md px-2 text-muted-foreground transition hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-[10rem] flex-1">
                    <Input
                      aria-label={`Số tiền khoản ${i + 1}`}
                      inputMode="numeric"
                      placeholder="0"
                      value={groupNumber(item.amount || '')}
                      onChange={(e) => {
                        const raw = parseNumber(e.target.value)
                        patch(i, { amount: raw ? Number(raw) : 0 })
                      }}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={item.optional} onCheckedChange={(v) => patch(i, { optional: v })} />
                    Tuỳ chọn
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
        <div className="flex items-center justify-between font-semibold">
          <span>Tổng phí bắt buộc</span>
          <span>{formatVnd(required)}</span>
        </div>
        {hasOptional && (
          <p className="mt-1 text-xs text-muted-foreground">
            Khoản tuỳ chọn ({formatVnd(all - required)}) không tính vào tổng — chủ tài sản chọn thêm nếu cần.
          </p>
        )}
        {commissionPct && (
          <p className="mt-1 text-xs text-muted-foreground">Cộng thù lao {commissionPct}% giá trúng đấu giá.</p>
        )}
      </div>
    </div>
  )
}
