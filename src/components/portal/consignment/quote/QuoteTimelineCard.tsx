import { Fragment } from 'react'
import { Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { QUOTE_MILESTONES } from '@/constants/quote-plan'
import type { QuotePlan } from '@/types/consignment'
import { DetailCard } from '../detail/DetailCard'
import { gapsFromMilestones, milestonesFromGaps } from './quoteForm'
import { Req } from './parts'

interface Props {
  milestones: QuotePlan['milestones']
  onChange: (ms: QuotePlan['milestones']) => void
}

const MARKERS = [{ key: '_ky', label: 'Ký hợp đồng' }, ...QUOTE_MILESTONES]

/**
 * Mốc thời gian dạng trục: tổ chức nhập SỐ NGÀY GIỮA hai mốc liền nhau, dưới
 * mỗi mốc hiện "Ngày N" luỹ tiến — đúng con số được lưu (mo_phien = lead time).
 * Màn hẹp thì trục dựng đứng.
 */
export function QuoteTimelineCard({ milestones, onChange }: Props) {
  const gaps = gapsFromMilestones(milestones)

  const setGap = (i: number, raw: string) => {
    const digits = raw.replace(/\D/g, '')
    const next = [...gaps]
    next[i] = digits ? Number(digits) : null
    onChange(milestonesFromGaps(next))
  }

  return (
    <DetailCard
      icon={Clock}
      title={
        <>
          Mốc thời gian <Req />
        </>
      }
    >
      <div className="my-1 flex flex-col lg:mt-2 lg:flex-row lg:items-start">
        {MARKERS.map((m, j) => {
          const day = j === 0 ? 0 : milestones[m.key as keyof typeof milestones]
          const edge = j === 0 || j === MARKERS.length - 1
          return (
            <Fragment key={m.key}>
              {j > 0 && (
                <div className="my-1 ml-1.5 border-l-2 border-primary/25 py-1.5 pl-5 lg:relative lg:my-0 lg:ml-0 lg:flex lg:min-w-[4.25rem] lg:flex-1 lg:justify-center lg:border-0 lg:p-0 lg:before:absolute lg:before:inset-x-0 lg:before:top-[17px] lg:before:h-0.5 lg:before:bg-primary/45 lg:before:content-['']">
                  <div className="relative flex w-[4.25rem] items-center">
                    <Input
                      inputMode="numeric"
                      placeholder="—"
                      aria-label={`Số ngày từ ${MARKERS[j - 1].label.toLowerCase()} đến ${m.label.toLowerCase()}`}
                      className="h-9 bg-card pl-2 pr-10 text-right tabular-nums"
                      value={gaps[j - 1] ?? ''}
                      onChange={(e) => setGap(j - 1, e.target.value)}
                    />
                    <span className="pointer-events-none absolute right-2 text-xs text-muted-foreground">ngày</span>
                  </div>
                </div>
              )}
              <div
                className={cn(
                  'flex items-center gap-2.5',
                  'lg:relative lg:min-w-[4.5rem] lg:flex-col lg:gap-1 lg:text-center',
                  "lg:before:absolute lg:before:inset-x-0 lg:before:top-[17px] lg:before:h-0.5 lg:before:bg-primary/45 lg:before:content-['']",
                  'lg:first:before:left-1/2 lg:last:before:right-1/2',
                )}
              >
                <i
                  className={cn(
                    'relative z-10 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-primary lg:mb-1.5 lg:mt-[11px]',
                    edge ? 'bg-primary' : 'bg-card',
                  )}
                />
                <b className="whitespace-nowrap text-[13px] font-medium leading-tight">{m.label}</b>
                <small className="ml-auto text-xs tabular-nums text-muted-foreground lg:ml-0">
                  {typeof day === 'number' ? `Ngày ${day}` : '—'}
                </small>
              </div>
            </Fragment>
          )
        })}
      </div>
    </DetailCard>
  )
}
