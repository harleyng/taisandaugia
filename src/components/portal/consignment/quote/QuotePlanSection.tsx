import { AlertTriangle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { groupNumber, parseNumber, vnWords } from '@/components/asset-posting/format'
import {
  DEPOSIT_LEGAL_RANGE, PROMOTION_CHANNELS, QUOTE_MILESTONES, SERVICE_SCOPE_ITEMS,
} from '@/constants/quote-plan'
import { depositAmount, depositOutOfLegalRange, milestonesOutOfOrder } from '@/lib/quotePlan'
import { AUCTION_FORMAT_LABELS, type AuctionFormat } from '@/types/asset-posting'
import type { OrgServiceRequest, QuotePlan } from '@/types/consignment'
import { formatVnd } from '@/lib/advertising/slug'

interface Props {
  plan: QuotePlan
  onChange: (patch: Partial<QuotePlan>) => void
  request: OrgServiceRequest | null
}

/** Ba trạng thái của một mục phạm vi dịch vụ. */
type ScopeState = 'included' | 'excluded' | 'unset'

/**
 * A. Phương án tổ chức đấu giá.
 *
 * Các ô ở đây cố ý dùng danh mục cố định (constants/quote-plan.ts) chứ không
 * phải văn xuôi: chủ tài sản phải đặt được hai báo giá cạnh nhau và so từng
 * dòng. Ô "khác" có để cho ngoại lệ mà không phá khung so sánh.
 */
export function QuotePlanSection({ plan, onChange, request }: Props) {
  const startingPrice = request?.starting_price ?? null
  const deposit = depositAmount(plan, startingPrice)
  const depositWarning = depositOutOfLegalRange(plan, startingPrice)
  const orderWarning = milestonesOutOfOrder(plan)
  const formatMismatch =
    !!plan.auction_format && !!request?.auction_format && plan.auction_format !== request.auction_format

  const toggleChannel = (key: string, on: boolean) =>
    onChange({
      channels: on ? [...plan.channels, key] : plan.channels.filter((c) => c !== key),
    })

  const scopeState = (key: string): ScopeState =>
    plan.scope_included.includes(key) ? 'included' : plan.scope_excluded.includes(key) ? 'excluded' : 'unset'

  const setScope = (key: string, state: ScopeState) =>
    onChange({
      scope_included:
        state === 'included'
          ? [...plan.scope_included.filter((s) => s !== key), key]
          : plan.scope_included.filter((s) => s !== key),
      scope_excluded:
        state === 'excluded'
          ? [...plan.scope_excluded.filter((s) => s !== key), key]
          : plan.scope_excluded.filter((s) => s !== key),
    })

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="q-format">Hình thức đấu giá đề xuất</Label>
          <Select
            value={plan.auction_format ?? undefined}
            onValueChange={(v) => onChange({ auction_format: v as AuctionFormat })}
          >
            <SelectTrigger id="q-format">
              <SelectValue placeholder="Chọn hình thức" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(AUCTION_FORMAT_LABELS) as AuctionFormat[]).map((f) => (
                <SelectItem key={f} value={f}>
                  {AUCTION_FORMAT_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formatMismatch && (
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Chủ tài sản mong muốn{' '}
              {AUCTION_FORMAT_LABELS[request!.auction_format as AuctionFormat] ?? request!.auction_format} — nêu lý do
              đề xuất khác ở phần ghi chú.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="q-step">Bước giá (VNĐ)</Label>
          <Input
            id="q-step"
            inputMode="numeric"
            placeholder="0"
            value={groupNumber(plan.price_step ?? '')}
            onChange={(e) => {
              const raw = parseNumber(e.target.value)
              onChange({ price_step: raw ? Number(raw) : null })
            }}
          />
          {plan.price_step != null && <p className="text-xs text-muted-foreground">{vnWords(plan.price_step)}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="q-deposit">Tiền đặt trước</Label>
          <div className="flex gap-2">
            <Select
              value={plan.deposit_mode}
              onValueChange={(v) => onChange({ deposit_mode: v as 'percent' | 'amount', deposit_value: null })}
            >
              <SelectTrigger className="w-28 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Theo %</SelectItem>
                <SelectItem value="amount">Số tiền</SelectItem>
              </SelectContent>
            </Select>
            <Input
              id="q-deposit"
              inputMode="decimal"
              placeholder={plan.deposit_mode === 'percent' ? '10' : '0'}
              value={
                plan.deposit_value == null
                  ? ''
                  : plan.deposit_mode === 'percent'
                    ? String(plan.deposit_value)
                    : groupNumber(plan.deposit_value)
              }
              onChange={(e) => {
                const raw =
                  plan.deposit_mode === 'percent'
                    ? e.target.value.replace(/[^\d.]/g, '')
                    : parseNumber(e.target.value)
                onChange({ deposit_value: raw ? Number(raw) : null })
              }}
            />
          </div>
          {plan.deposit_mode === 'percent' && deposit != null && (
            <p className="text-xs text-muted-foreground">≈ {formatVnd(deposit)} theo giá khởi điểm</p>
          )}
          {depositWarning && (
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Ngoài khung {DEPOSIT_LEGAL_RANGE.min}–{DEPOSIT_LEGAL_RANGE.max}% giá khởi điểm theo Luật Đấu giá tài sản.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="q-venue">Địa điểm tổ chức</Label>
          <Input
            id="q-venue"
            placeholder="Trụ sở tổ chức, hội trường…"
            value={plan.venue ?? ''}
            onChange={(e) => onChange({ venue: e.target.value || null })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Kênh niêm yết & thông báo</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROMOTION_CHANNELS.map((c) => (
            <label key={c.key} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={plan.channels.includes(c.key)}
                onCheckedChange={(v) => toggleChannel(c.key, v === true)}
              />
              {c.label}
            </label>
          ))}
        </div>
        <Input
          placeholder="Kênh khác (nếu có)"
          value={plan.channels_other ?? ''}
          onChange={(e) => onChange({ channels_other: e.target.value || null })}
        />
      </div>

      <div className="space-y-2">
        <Label>Mốc thời gian</Label>
        <p className="text-xs text-muted-foreground">Số ngày kể từ khi ký hợp đồng dịch vụ.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUOTE_MILESTONES.map((m) => (
            <div key={m.key} className="space-y-1">
              <Label htmlFor={`q-ms-${m.key}`} className="text-xs font-normal text-muted-foreground">
                {m.label}
              </Label>
              <Input
                id={`q-ms-${m.key}`}
                inputMode="numeric"
                placeholder="—"
                value={plan.milestones[m.key] ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, '')
                  const next = { ...plan.milestones }
                  if (raw) next[m.key] = Number(raw)
                  else delete next[m.key]
                  onChange({ milestones: next })
                }}
              />
            </div>
          ))}
        </div>
        {orderWarning && (
          <p className="flex items-start gap-1.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Các mốc phải tăng dần — niêm yết không thể sớm hơn thẩm định.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Phạm vi dịch vụ</Label>
        <div className="space-y-1.5">
          {SERVICE_SCOPE_ITEMS.map((s) => {
            const state = scopeState(s.key)
            return (
              <div key={s.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{s.label}</span>
                <div className="flex shrink-0 gap-1">
                  {(
                    [
                      ['included', 'Bao gồm'],
                      ['excluded', 'Không'],
                    ] as [ScopeState, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setScope(s.key, state === value ? 'unset' : value)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition ${
                        state === value
                          ? value === 'included'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-muted text-muted-foreground'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      }`}
                      aria-pressed={state === value}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
