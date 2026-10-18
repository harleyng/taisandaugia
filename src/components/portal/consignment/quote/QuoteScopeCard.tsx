import { Check, ClipboardCheck, FileText, Gavel, ListChecks, Megaphone, Scale, Truck, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SERVICE_SCOPE_ITEMS } from '@/constants/quote-plan'
import type { QuotePlan } from '@/types/consignment'
import { DetailCard } from '../detail/DetailCard'

const SCOPE_ICON: Record<string, LucideIcon> = {
  ho_so: FileText,
  niem_yet: Megaphone,
  dau_gia_vien: Gavel,
  thu_tuc: ClipboardCheck,
  van_chuyen: Truck,
  tham_dinh_gia: Scale,
}

interface Props {
  plan: QuotePlan
  onPlan: (patch: Partial<QuotePlan>) => void
}

/**
 * Phạm vi dịch vụ: thẻ bấm chọn mục BAO GỒM. Không còn nút "Không bao gồm" —
 * báo giá cũ có mục loại trừ vẫn giữ nguyên, chỉ bỏ khi mục đó được chọn lại.
 */
export function QuoteScopeCard({ plan, onPlan }: Props) {
  const toggle = (key: string) => {
    const on = !plan.scope_included.includes(key)
    onPlan({
      scope_included: on ? [...plan.scope_included, key] : plan.scope_included.filter((s) => s !== key),
      scope_excluded: plan.scope_excluded.filter((s) => s !== key),
    })
  }

  return (
    <DetailCard icon={ListChecks} title="Phạm vi dịch vụ">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 min-[900px]:grid-cols-3">
        {SERVICE_SCOPE_ITEMS.map((s) => {
          const on = plan.scope_included.includes(s.key)
          const Icon = SCOPE_ICON[s.key] ?? FileText
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(s.key)}
              className={cn(
                'relative flex items-center gap-3 rounded-xl border bg-card py-3 pl-3 pr-9 text-left text-sm transition-colors',
                on ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/50',
              )}
            >
              <span
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-[10px]',
                  on ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="font-medium leading-tight">{s.label}</span>
              <span
                className={cn(
                  'absolute right-3 top-1/2 grid h-[18px] w-[18px] -translate-y-1/2 place-items-center rounded-full border-[1.5px]',
                  on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent',
                )}
              >
                <Check className="h-[11px] w-[11px]" strokeWidth={3} />
              </span>
            </button>
          )
        })}
      </div>
    </DetailCard>
  )
}
