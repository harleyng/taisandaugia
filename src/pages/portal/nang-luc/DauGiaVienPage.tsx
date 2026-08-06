import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useAuctioneers } from '@/hooks/useAuctioneers'
import { useOrgCpd } from '@/hooks/useOrgCpd'
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
import { Users, IdCard, Loader2, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { LegacyImportBanner } from '@/components/auctioneers/LegacyImportBanner'

export default function DauGiaVienPage() {
  const navigate = useNavigate()
  const {
    auctioneers,
    score,
    pendingConflicts,
    expiringLicenses,
    addAuctioneer,
    updateAuctioneer,
    removeAuctioneer,
    resolveConflict,
    isLoading,
    hasOrg,
    organizationId,
    auctionOrgId,
  } = useAuctioneers()

  // Cảnh báo bồi dưỡng hiện SONG SONG cảnh báo hết hạn thẻ ngay trên màn này —
  // đây là nơi người quản lý đội ngũ nhìn hằng ngày.
  const cpdYear = new Date().getFullYear()
  const { summary: cpdSummary } = useOrgCpd(cpdYear)

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

  if (isLoading) {
    return (
      <div className="px-6 py-6">
        <Card className="p-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải danh sách đấu giá viên…
        </Card>
      </div>
    )
  }

  // Chưa xác thực tổ chức thì chưa có chỗ để ghi — nói rõ thay vì quay vòng.
  if (!hasOrg) {
    return (
      <div className="px-6 py-6">
        <Card className="p-10 text-center space-y-3 rounded-2xl">
          <ShieldAlert className="h-9 w-9 text-muted-foreground mx-auto" />
          <div>
            <p className="text-sm font-medium">Chưa có hồ sơ tổ chức</p>
            <p className="text-xs text-muted-foreground mt-1">
              Hoàn tất xác thực tổ chức đấu giá để bắt đầu quản lý đội ngũ đấu giá viên.
            </p>
          </div>
          <Button size="sm" onClick={() => navigate('/dang-ky-to-chuc')}>
            Xác thực tổ chức
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="px-6 py-6 space-y-5">
      {organizationId && (
        <LegacyImportBanner
          organizationId={organizationId}
          auctionOrgId={auctionOrgId}
          hasRemoteData={hasData}
          onImported={() => undefined}
        />
      )}

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
          cpdPending={cpdSummary.short + cpdSummary.overdue}
          cpdYear={cpdYear}
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

      {hasData && (
        <Card className="p-4 rounded-2xl flex items-start gap-3">
          <IdCard className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Xuất hồ sơ đấu giá viên theo mẫu</p>
            <p className="text-xs text-muted-foreground mt-1">
              Khai báo định danh, giấy tờ và quá trình công tác ngay tại hồ sơ từng
              người ở đây; sang mục Hồ sơ nhân sự để kết xuất ra file theo mẫu.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => navigate('/portal/nhan-su')}
          >
            Mở hồ sơ nhân sự
          </Button>
        </Card>
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
