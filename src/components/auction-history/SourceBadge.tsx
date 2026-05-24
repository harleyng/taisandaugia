import { Badge } from '@/components/ui/badge'
import type { AuctionBadgeSource } from '@/types/auction-record'

const CONFIG: Record<AuctionBadgeSource, { label: string; className: string }> = {
  VERIFIED: { label: '🔒 Cổng QG', className: 'bg-primary/10 text-primary border-primary/20' },
  MANUAL: { label: '✏️ Thủ công', className: 'bg-muted text-muted-foreground border-border' },
  IMPORTED: { label: '📤 Import', className: 'bg-accent/10 text-amber-700 border-accent/20' },
  MODIFIED: { label: '⚠️ Đã sửa', className: 'bg-warning/10 text-amber-700 border-warning/20' },
  CONFLICT: { label: '🔄 Xung đột', className: 'bg-destructive/10 text-destructive border-destructive/20' },
}

interface Props {
  source: AuctionBadgeSource
}

export function SourceBadge({ source }: Props) {
  const { label, className } = CONFIG[source]
  return (
    <Badge variant="outline" className={`text-xs font-normal ${className}`}>
      {label}
    </Badge>
  )
}
