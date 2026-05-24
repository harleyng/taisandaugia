import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useAuctioneers } from '@/hooks/useAuctioneers'
import type { Auctioneer } from '@/types/auctioneer'
import { ScoreInlineBar } from '@/components/portal/ScoreInlineBar'
import { ScoreBreakdownDialog } from '@/components/portal/ScoreBreakdownDialog'
import { MUC_IV68_BREAKDOWN } from '@/lib/portal/scoreBreakdowns'
import { AuctioneerStatsCards } from '@/components/auctioneers/AuctioneerStatsCards'
import { AuctioneerWarnings } from '@/components/auctioneers/AuctioneerWarnings'
import { AuctioneerTable } from '@/components/auctioneers/AuctioneerTable'
import { AuctioneerForm } from '@/components/auctioneers/AuctioneerForm'
import { ConflictResolutionDialog } from '@/components/auctioneers/ConflictResolutionDialog'
import { Card } from '@/components/ui/card'
import { Users } from 'lucide-react'

export default function DauGiaVienPage() {
  const {
    auctioneers,
    score,
    pendingConflicts,
    expiringLicenses,
    addAuctioneer,
    updateAuctioneer,
    removeAuctioneer,
    resolveConflict,
  } = useAuctioneers()

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [conflictOpen, setConflictOpen] = useState(false)

  const hasData = auctioneers.length > 0
  const existingToEdit = editingId ? auctioneers.find((a) => a.id === editingId) : undefined
  const activeCount = auctioneers.filter((a) => a.isActive).length

  const handleEdit = (id: string) => { setEditingId(id); setFormOpen(true) }
  const handleAdd = () => { setEditingId(null); setFormOpen(true) }
  const handleFormSave = (a: Auctioneer) => {
    if (editingId) updateAuctioneer(a)
    else addAuctioneer(a)
    setEditingId(null)
  }
  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open)
    if (!open) setEditingId(null)
  }

  return (
    <div className="px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Đấu giá viên</h1>
          <div className="flex items-center gap-1.5">
            {hasData && <ScoreInlineBar label="Mục IV.6-8" score={score.total} max={13} />}
            <ScoreBreakdownDialog data={MUC_IV68_BREAKDOWN} />
          </div>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Thêm thủ công
        </Button>
      </div>

      {hasData && <AuctioneerStatsCards auctioneers={auctioneers} score={score} />}

      {hasData && (
        <AuctioneerWarnings
          pendingConflicts={pendingConflicts}
          expiringLicenses={expiringLicenses}
          onShowConflicts={() => setConflictOpen(true)}
          onEditAuctioneer={handleEdit}
        />
      )}

      {!hasData && (
        <Card className="p-10 text-center space-y-3">
          <Users className="h-9 w-9 text-muted-foreground mx-auto" />
          <div>
            <p className="text-sm font-medium">Chưa có đấu giá viên</p>
            <p className="text-xs text-muted-foreground mt-1">
              Thêm từng người thủ công để bắt đầu.
            </p>
          </div>
          <Button size="sm" onClick={handleAdd} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Thêm thủ công
          </Button>
        </Card>
      )}

      {hasData && (
        <AuctioneerTable
          auctioneers={auctioneers}
          onEdit={handleEdit}
          onDelete={removeAuctioneer}
        />
      )}

      <AuctioneerForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        existing={existingToEdit as Auctioneer | undefined}
        onSave={handleFormSave}
      />

      <ConflictResolutionDialog
        open={conflictOpen}
        onOpenChange={setConflictOpen}
        conflicts={pendingConflicts}
        auctioneers={auctioneers}
        onResolve={resolveConflict}
      />
    </div>
  )
}
