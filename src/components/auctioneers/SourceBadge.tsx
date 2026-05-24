import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { BadgeSource } from '@/types/auctioneer'

const BADGE_CONFIG: Record<
  BadgeSource,
  { label: string; icon: string; className: string; tooltip: string }
> = {
  VERIFIED: {
    label: 'Verified',
    icon: '🔒',
    className: 'bg-primary/10 text-primary border-primary/20',
    tooltip: 'Dữ liệu từ Cổng đấu giá QG (Bộ Tư pháp), chưa có thay đổi thủ công.',
  },
  MANUAL: {
    label: 'Thủ công',
    icon: '✏️',
    className: 'bg-muted text-muted-foreground border-border',
    tooltip: 'Dữ liệu do người dùng nhập thủ công, không có trên Cổng QG.',
  },
  MODIFIED: {
    label: 'Đã sửa',
    icon: '⚠️',
    className: 'bg-warning/10 text-warning border-warning/20',
    tooltip: 'Dữ liệu từ Cổng QG nhưng đã có ít nhất 1 trường được sửa thủ công.',
  },
  CONFLICT: {
    label: 'Conflict',
    icon: '🔄',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
    tooltip: 'Cổng QG vừa cập nhật thông tin mâu thuẫn với dữ liệu hiện tại. Cần resolve.',
  },
}

interface Props {
  source: BadgeSource
  size?: 'sm' | 'xs'
}

export function SourceBadge({ source, size = 'sm' }: Props) {
  const cfg = BADGE_CONFIG[source]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={`${cfg.className} ${size === 'xs' ? 'text-[10px] px-1 py-0' : 'text-xs'} gap-1 cursor-default`}
        >
          <span>{cfg.icon}</span>
          {cfg.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{cfg.tooltip}</TooltipContent>
    </Tooltip>
  )
}
