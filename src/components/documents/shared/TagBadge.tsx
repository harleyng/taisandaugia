import { X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Props {
  tag: string
  onRemove?: () => void
  className?: string
}

export function TagBadge({ tag, onRemove, className }: Props) {
  return (
    <Badge
      variant="secondary"
      className={cn('text-xs gap-1 font-normal', className)}
    >
      #{tag}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 hover:text-destructive"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </Badge>
  )
}
