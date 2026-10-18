import { useRef } from 'react'
import { Megaphone } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { PROMOTION_CHANNELS } from '@/constants/quote-plan'
import type { QuotePlan } from '@/types/consignment'
import { DetailCard } from '../detail/DetailCard'

interface Props {
  plan: QuotePlan
  onPlan: (patch: Partial<QuotePlan>) => void
  otherOn: boolean
  onOtherOn: (on: boolean) => void
}

/** Kênh niêm yết & thông báo — danh mục cố định + "Khác" mở ô gõ tên. */
export function QuoteChannelsCard({ plan, onPlan, otherOn, onOtherOn }: Props) {
  const otherRef = useRef<HTMLInputElement>(null)

  const toggle = (key: string, on: boolean) =>
    onPlan({ channels: on ? [...plan.channels, key] : plan.channels.filter((c) => c !== key) })

  return (
    <DetailCard icon={Megaphone} title="Kênh niêm yết & thông báo">
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        {PROMOTION_CHANNELS.map((c) => (
          <label key={c.key} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={plan.channels.includes(c.key)} onCheckedChange={(v) => toggle(c.key, v === true)} />
            {c.label}
          </label>
        ))}
        <div className="flex min-h-6 items-center gap-3">
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={otherOn}
              onCheckedChange={(v) => {
                const on = v === true
                onOtherOn(on)
                if (!on) onPlan({ channels_other: null })
                else requestAnimationFrame(() => otherRef.current?.focus())
              }}
            />
            Khác
          </label>
          {otherOn && (
            <Input
              ref={otherRef}
              aria-label="Tên kênh khác"
              placeholder="Nhập tên kênh"
              className="h-8 min-w-0 flex-1 text-[13px]"
              value={plan.channels_other ?? ''}
              onChange={(e) => onPlan({ channels_other: e.target.value })}
            />
          )}
        </div>
      </div>
    </DetailCard>
  )
}
