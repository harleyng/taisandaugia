import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AuctioneerWithComputed, ConflictRecord } from '@/types/auctioneer'

interface Props {
  pendingConflicts: ConflictRecord[]
  expiringLicenses: AuctioneerWithComputed[]
  onShowConflicts: () => void
  onEditAuctioneer: (id: string) => void
}

export function AuctioneerWarnings({
  pendingConflicts,
  expiringLicenses,
  onShowConflicts,
  onEditAuctioneer,
}: Props) {
  if (pendingConflicts.length === 0 && expiringLicenses.length === 0) return null

  // Deduplicate conflicts by auctioneer
  const conflictAuctioneerIds = [...new Set(pendingConflicts.map((c) => c.auctioneerId))]

  return (
    <div className="space-y-2">
      {conflictAuctioneerIds.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/5 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium">{conflictAuctioneerIds.length} ĐGV</span> có conflict cần resolve từ đồng bộ Cổng QG
            </span>
          </div>
          <Button variant="ghost" size="sm" className="text-warning hover:text-warning shrink-0" onClick={onShowConflicts}>
            Xem →
          </Button>
        </div>
      )}

      {expiringLicenses.map((a) => (
        <div
          key={a.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/5 px-4 py-2.5"
        >
          <div className="flex items-center gap-2 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Thẻ ĐGV{' '}
              <span className="font-medium">{a.fullName}</span>{' '}
              sắp hết hạn ({a.daysUntilLicenseExpiry} ngày)
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-warning hover:text-warning shrink-0"
            onClick={() => onEditAuctioneer(a.id)}
          >
            Sửa →
          </Button>
        </div>
      ))}
    </div>
  )
}
