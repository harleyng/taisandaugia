import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Label } from '@/components/ui/label'

/** Nhãn nhóm viết hoa giữa các thẻ ("PHƯƠNG ÁN TỔ CHỨC"). */
export function QuoteGroup({ children }: { children: ReactNode }) {
  return (
    <p className="-mb-2 mt-3 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground first:mt-0">
      {children}
    </p>
  )
}

export function Req() {
  return <span className="text-destructive">*</span>
}

/** Ô nhập kèm nhãn; `required` gắn dấu * đỏ. */
export function Field({
  label, htmlFor, required, children,
}: { label: ReactNode; htmlFor?: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label} {required && <Req />}
      </Label>
      {children}
    </div>
  )
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}

export function Warn({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-warning">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {children}
    </p>
  )
}

/** Ô số có hậu tố (đ, ngày…) nằm trong ô. */
export function Suffix({ suffix, children }: { suffix: string; children: ReactNode }) {
  return (
    <div className="relative flex items-center">
      {children}
      <span className="pointer-events-none absolute right-3 text-[13px] text-muted-foreground">{suffix}</span>
    </div>
  )
}
