import { Badge } from '@/components/ui/badge'
import type { AuctionBadgeSource } from '@/types/auction-record'

const CONFIG: Record<AuctionBadgeSource, { label: string; className: string }> = {
  AUTO: { label: 'Tự động', className: 'bg-primary/10 text-primary border-primary/20' },
  USER_VERIFIED: { label: 'Đã xác thực', className: 'bg-success/10 text-success border-success/20' },
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
