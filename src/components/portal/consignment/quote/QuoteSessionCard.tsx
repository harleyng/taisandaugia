import { Scale } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { groupNumber, parseNumber } from '@/components/asset-posting/format'
import { DEPOSIT_LEGAL_RANGE } from '@/constants/quote-plan'
import { depositAmount, depositOutOfLegalRange } from '@/lib/quotePlan'
import { formatVnd } from '@/lib/advertising/slug'
import { AUCTION_FORMAT_LABELS, type AuctionFormat } from '@/types/asset-posting'
import type { OrgServiceRequest, QuotePlan } from '@/types/consignment'
import { DetailCard } from '../detail/DetailCard'
import { Field, Hint, Suffix, Warn } from './parts'

interface Props {
  request: OrgServiceRequest
  plan: QuotePlan
  onPlan: (patch: Partial<QuotePlan>) => void
  appraisal: boolean
  /** Giá khởi điểm đang dùng làm gốc (chủ TS đặt, hoặc tổ chức đề xuất khi nhờ định giá). */
  base: number
  startingPrice: string
  onStartingPrice: (v: string) => void
  validUntil: string
  onValidUntil: (v: string) => void
  today: string
}

/** "Thông tin phiên đấu giá": hình thức, địa điểm, giá khởi điểm, đặt trước, bước giá, hiệu lực. */
export function QuoteSessionCard({
  request: r, plan, onPlan, appraisal, base, startingPrice, onStartingPrice, validUntil, onValidUntil, today,
}: Props) {
  const deposit = plan.deposit_mode === 'percent' ? depositAmount(plan, base || null) : null
  const wantedFormat = r.auction_format as AuctionFormat
  const formatMismatch = !!plan.auction_format && !!r.auction_format && plan.auction_format !== r.auction_format

  return (
    <DetailCard icon={Scale} title="Thông tin phiên đấu giá">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Hình thức đấu giá đề xuất" htmlFor="q-format" required>
          <Select value={plan.auction_format ?? undefined} onValueChange={(v) => onPlan({ auction_format: v as AuctionFormat })}>
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
            <Warn>
              Chủ tài sản mong muốn {AUCTION_FORMAT_LABELS[wantedFormat] ?? r.auction_format} — nêu lý do đề xuất khác ở
              phần ghi chú.
            </Warn>
          )}
        </Field>

        <Field label="Địa điểm tổ chức" htmlFor="q-venue">
          <Input
            id="q-venue"
            placeholder="Trụ sở tổ chức, hội trường…"
            value={plan.venue ?? ''}
            onChange={(e) => onPlan({ venue: e.target.value })}
          />
        </Field>

        <Field label="Giá khởi điểm đề xuất" htmlFor="q-price" required={appraisal}>
          {appraisal ? (
            <>
              <Suffix suffix="đ">
                <Input
                  id="q-price"
                  inputMode="numeric"
                  placeholder="0"
                  className="pr-10 tabular-nums"
                  value={groupNumber(startingPrice)}
                  onChange={(e) => onStartingPrice(parseNumber(e.target.value))}
                />
              </Suffix>
              <Hint>Chủ tài sản nhờ tổ chức định giá</Hint>
            </>
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div tabIndex={0} className="cursor-not-allowed rounded-md outline-none">
                    <Suffix suffix="đ">
                      <Input
                        id="q-price"
                        disabled
                        className="pointer-events-none bg-muted pr-10 tabular-nums text-muted-foreground disabled:opacity-100"
                        value={groupNumber(r.starting_price ?? '')}
                      />
                    </Suffix>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Chủ tài sản đã tự đặt giá khởi điểm {formatVnd(r.starting_price)}. Tổ chức không đề xuất lại — nếu thấy
                  chưa hợp lý, nêu ở phần ghi chú.
                </TooltipContent>
              </Tooltip>
              <Hint>Do chủ tài sản đặt</Hint>
            </>
          )}
        </Field>

        <Field label="Tiền đặt trước" htmlFor="q-deposit" required>
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
            <Input
              id="q-deposit"
              inputMode="decimal"
              className="text-right tabular-nums"
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
                  plan.deposit_mode === 'percent' ? e.target.value.replace(/[^\d.]/g, '') : parseNumber(e.target.value)
                onPlan({ deposit_value: raw ? Number(raw) : null })
              }}
            />
            <Select
              value={plan.deposit_mode}
              onValueChange={(v) => onPlan({ deposit_mode: v as 'percent' | 'amount', deposit_value: null })}
            >
              <SelectTrigger aria-label="Đơn vị tiền đặt trước">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">%</SelectItem>
                <SelectItem value="amount">VND</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {deposit != null && deposit > 0 && <Hint>≈ {formatVnd(deposit)} theo giá khởi điểm</Hint>}
          {plan.deposit_mode === 'percent' && depositOutOfLegalRange(plan, base || null) && (
            <Warn>
              Ngoài khung {DEPOSIT_LEGAL_RANGE.min}–{DEPOSIT_LEGAL_RANGE.max}% giá khởi điểm theo Luật Đấu giá tài sản.
            </Warn>
          )}
        </Field>

        <Field label="Bước giá" htmlFor="q-step" required>
          <Suffix suffix="đ">
            <Input
              id="q-step"
              inputMode="numeric"
              placeholder="0"
              className="pr-10 tabular-nums"
              value={groupNumber(plan.price_step ?? '')}
              onChange={(e) => {
                const raw = parseNumber(e.target.value)
                onPlan({ price_step: raw ? Number(raw) : null })
              }}
            />
          </Suffix>
        </Field>

        <Field label="Hiệu lực báo giá đến" htmlFor="q-valid" required>
          <Input id="q-valid" type="date" min={today} value={validUntil} onChange={(e) => onValidUntil(e.target.value)} />
        </Field>
      </div>
    </DetailCard>
  )
}
