import { Button } from '@/components/ui/button'
import { RefreshCw, Info } from 'lucide-react'
import type { CrawlSession } from '@/types/auctioneer'
import type { CrawlState } from '@/hooks/useAuctioneers'

interface Props {
  lastCrawl?: CrawlSession
  crawlState: CrawlState
  onSync: () => void
}

export function AuctioneerSyncBanner({ lastCrawl, crawlState, onSync }: Props) {
  const isLoading = crawlState === 'loading'

  const lastSyncLabel = lastCrawl?.completedAt
    ? new Date(lastCrawl.completedAt).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Info className="h-4 w-4 shrink-0" />
        {lastSyncLabel ? (
          <span>
            Đồng bộ lần cuối từ Cổng QG:{' '}
            <span className="font-medium text-foreground">{lastSyncLabel}</span>
          </span>
        ) : (
          <span>Chưa đồng bộ từ Cổng đấu giá tài sản quốc gia</span>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 shrink-0"
        onClick={onSync}
        disabled={isLoading}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        {isLoading ? 'Đang tìm...' : 'Đồng bộ ngay'}
      </Button>
    </div>
  )
}
