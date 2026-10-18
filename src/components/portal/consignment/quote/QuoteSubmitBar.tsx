import { Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatVnd } from '@/lib/advertising/slug'

interface Props {
  commissionPct: string
  total: number
  leadDays: number | null
  /** Chỉ hiện sau lần bấm gửi đầu tiên. */
  errors: string[]
  busyLabel: string | null
  submitLabel: string
  onSubmit: () => void
}

/** Thanh dính đáy, full bề ngang vùng nội dung (nội dung căn theo khung 1280px của thẻ): ba con số chủ tài sản sẽ đem đi so sánh + nút gửi. */
export function QuoteSubmitBar({ commissionPct, total, leadDays, errors, busyLabel, submitLabel, onSubmit }: Props) {
  const stats: [string, string][] = [
    ['Thù lao', commissionPct ? `${commissionPct}%` : '—'],
    ['Tổng chi phí', formatVnd(total)],
    ['Mở phiên sau', leadDays != null ? `${leadDays} ngày` : '—'],
  ]

  return (
    <div className="sticky bottom-0 z-20 border-t border-border bg-card/95 py-3 shadow-[0_-6px_16px_-8px_hsl(222_47%_11%/0.12)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-2.5 px-4 md:px-8">
        {errors.length > 0 && (
          <ul className="flex list-disc flex-col gap-0.5 rounded-lg border border-destructive/30 bg-destructive/5 py-2.5 pl-7 pr-3 text-xs text-destructive">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-6">
          <dl className="m-0 flex flex-1 flex-wrap gap-8">
            {stats.map(([label, value]) => (
              <div key={label} className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="m-0 text-base font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <Button className="min-w-48 gap-2" disabled={!!busyLabel} onClick={onSubmit}>
            {busyLabel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {busyLabel ?? submitLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
