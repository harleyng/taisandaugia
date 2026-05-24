import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import type { ConflictRecord, AuctioneerWithComputed } from '@/types/auctioneer'
import { FIELD_LABELS } from '@/types/auctioneer'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  conflicts: ConflictRecord[]
  auctioneers: AuctioneerWithComputed[]
  onResolve: (auctioneerId: string, field: string, resolution: 'KEEP_CURRENT' | 'USE_NEW', newValue?: string) => void
}

export function ConflictResolutionDialog({ open, onOpenChange, conflicts, auctioneers, onResolve }: Props) {
  const getName = (id: string) => auctioneers.find((a) => a.id === id)?.fullName ?? id

  const handleKeep = (c: ConflictRecord) => {
    onResolve(c.auctioneerId, c.field, 'KEEP_CURRENT')
  }

  const handleUseNew = (c: ConflictRecord) => {
    onResolve(c.auctioneerId, c.field, 'USE_NEW', c.newValueFromCrawl)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Phát hiện {conflicts.length} thay đổi từ Cổng QG
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {conflicts.map((c) => (
            <div key={`${c.auctioneerId}-${c.field}`} className="rounded-lg border border-border p-4 space-y-3">
              <p className="text-sm font-medium">
                {getName(c.auctioneerId)}
                <span className="text-muted-foreground font-normal"> — {FIELD_LABELS[c.field] ?? c.field}</span>
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-muted/50 p-2">
                  <p className="text-muted-foreground mb-1">Hiện tại (của bạn)</p>
                  <p className="font-medium break-all">{c.currentValue}</p>
                </div>
                <div className="rounded bg-primary/5 border border-primary/20 p-2">
                  <p className="text-muted-foreground mb-1">Cổng QG (mới)</p>
                  <p className="font-medium break-all">{c.newValueFromCrawl}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleKeep(c)}>
                  Giữ hiện tại
                </Button>
                <Button size="sm" className="flex-1" onClick={() => handleUseNew(c)}>
                  Dùng mới
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleKeep(c)}>
                  Để sau
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
