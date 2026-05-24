import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface InfoFieldProps {
  icon: LucideIcon
  label: string
  value?: string | null
  emptyLabel?: string
  onAdd?: () => void
}

export function InfoField({ icon: Icon, label, value, emptyLabel = '—', onAdd }: InfoFieldProps) {
  return (
    <div className="flex items-start gap-2.5 min-h-[1.75rem]">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground block leading-none mb-0.5">{label}</span>
        {value ? (
          <span className="text-sm text-foreground break-words">{value}</span>
        ) : onAdd ? (
          <Button variant="ghost" size="sm" className="h-5 p-0 text-xs text-muted-foreground hover:text-foreground" onClick={onAdd}>
            + Thêm
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground/60">{emptyLabel}</span>
        )}
      </div>
    </div>
  )
}
