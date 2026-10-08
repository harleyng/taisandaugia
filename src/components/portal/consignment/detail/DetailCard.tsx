import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DetailCardProps {
  icon?: LucideIcon
  title: ReactNode
  /** Góc phải tiêu đề: chữ phụ hoặc huy hiệu. */
  aside?: ReactNode
  children: ReactNode
}

/** Thẻ trắng đổ bóng của trang chi tiết: tiêu đề 16px + thân cách 16px. */
export function DetailCard({ icon: Icon, title, aside, children }: DetailCardProps) {
  return (
    <section className="rounded-2xl bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 px-6 pb-3 pt-5">
        <h2 className="flex min-w-0 flex-wrap items-center gap-2 text-base font-semibold">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
          {title}
        </h2>
        {aside}
      </div>
      <div className="flex flex-col gap-4 px-6 pb-6">{children}</div>
    </section>
  )
}

export function CardAux({ children }: { children: ReactNode }) {
  return <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">{children}</span>
}

/** Nhãn nhóm viết hoa trong thẻ ("BÊN A — CHỦ TÀI SẢN"). */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">{children}</div>
}

export function InfoList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('flex flex-col gap-2.5', className)}>{children}</dl>
}

/** Một dòng nhãn | giá trị; giá trị rỗng thì không hiện. */
export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div className="grid grid-cols-[minmax(8rem,13rem)_minmax(0,1fr)] items-baseline gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="m-0 font-medium [overflow-wrap:anywhere]">{value}</dd>
    </div>
  )
}

/** Hộp ghi chú bo 12px theo sắc thái. */
export function Note({ tone = 'muted', children }: { tone?: 'muted' | 'primary' | 'warning' | 'accent'; children: ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3 text-sm',
        tone === 'muted' && 'border-border bg-muted/50',
        tone === 'primary' && 'border-primary/20 bg-primary/5',
        tone === 'warning' && 'border-warning/30 bg-warning/[0.06]',
        tone === 'accent' && 'border-accent/40 bg-accent/10',
      )}
    >
      {children}
    </div>
  )
}
