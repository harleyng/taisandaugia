import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RefreshCw, Info } from 'lucide-react'
import { format } from 'date-fns'
import type { AuctionCrawlSession, ImportSession } from '@/types/auction-record'
import type { CrawlState } from '@/hooks/useAuctionHistory'

interface Props {
  lastCrawl?: AuctionCrawlSession
  lastImport?: ImportSession
  crawlState: CrawlState
  onCrawl: () => void
}

export function SyncStatusBanner({ lastCrawl, lastImport, crawlState, onCrawl }: Props) {
  const formatDate = (iso: string) => format(new Date(iso), 'dd/MM')

  return (
    <Card className="p-3 bg-muted/30 border-border">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Info className="h-4 w-4 shrink-0" />
          <span>
            {lastCrawl
              ? `Đồng bộ Cổng QG: ${formatDate(lastCrawl.completedAt ?? lastCrawl.startedAt)}`
              : 'Chưa đồng bộ Cổng QG'}
            {lastImport && ` · Import: ${formatDate(lastImport.importedAt)}`}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0"
          onClick={onCrawl}
          disabled={crawlState === 'loading'}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${crawlState === 'loading' ? 'animate-spin' : ''}`} />
          {lastCrawl ? 'Đồng bộ ngay (10 credit)' : 'Đồng bộ lần đầu (Miễn phí)'}
        </Button>
      </div>
    </Card>
  )
}
