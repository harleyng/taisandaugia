import { RefreshCw, Clock } from 'lucide-react'
import type { CrawlState } from '@/hooks/useAuctionHistory'

interface Props {
  crawlState: CrawlState
}

export function AutoSyncEmptyState({ crawlState }: Props) {
  const isSyncing = crawlState === 'loading'

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      {isSyncing ? (
        <RefreshCw className="h-10 w-10 text-primary animate-spin" />
      ) : (
        <Clock className="h-10 w-10 text-muted-foreground" />
      )}
      <div>
        <p className="text-sm font-medium">
          {isSyncing ? 'Đang đồng bộ dữ liệu...' : 'Chưa có dữ liệu đấu giá'}
        </p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {isSyncing
            ? 'Hệ thống đang tìm lịch sử đấu giá từ Cổng quốc gia. Vui lòng chờ.'
            : 'Dữ liệu cuộc đấu giá được đồng bộ tự động từ Cổng đấu giá tài sản quốc gia (dgts.moj.gov.vn). Nhấn "Đồng bộ ngay" để kiểm tra.'}
        </p>
      </div>
    </div>
  )
}
