import { Badge } from '@/components/ui/badge'
import type { BadgeSource } from '@/types/auctioneer'

const BADGE_CONFIG: Record<BadgeSource, { label: string; className: string }> = {
  AUTO: { label: 'Tự động', className: 'bg-primary/10 text-primary border-primary/20' },
  USER_VERIFIED: { label: 'Đã xác thực', className: 'bg-success/10 text-success border-success/20' },
}

interface Props {
  source: BadgeSource
  size?: 'sm' | 'xs'
}

export function SourceBadge({ source, size = 'sm' }: Props) {
  const { label, className } = BADGE_CONFIG[source]
  return (
    <Badge
      variant="outline"
      className={`${className} font-normal ${size === 'xs' ? 'text-[10px] px-1 py-0' : 'text-xs'}`}
    >
      {label}
    </Badge>
  )
}
