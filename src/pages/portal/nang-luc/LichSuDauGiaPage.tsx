import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, Loader2 } from 'lucide-react'
import { useAuctionHistory } from '@/hooks/useAuctionHistory'
import { ScoreInlineBar } from '@/components/portal/ScoreInlineBar'
import { ScoreBreakdownDialog } from '@/components/portal/ScoreBreakdownDialog'
import { MUC_IV14_BREAKDOWN } from '@/lib/portal/scoreBreakdowns'
import { AuctionStatsCards } from '@/components/auction-history/AuctionStatsCards'
import { EnrichmentAlertBanner } from '@/components/auction-history/EnrichmentAlertBanner'
import { AuctionTable } from '@/components/auction-history/AuctionTable'
import { AuctionRecordDialog } from '@/components/auction-history/AuctionRecordDialog'
import { AuctionDetailDrawer } from '@/components/auction-history/AuctionDetailDrawer'
import { ImportDialog } from '@/components/auction-history/import/ImportDialog'
import type { AuctionRecordWithComputed, AuctionRecord } from '@/types/auction-record'

type TabKey = 'all' | 'successful' | 'needs_fill' | 'failed'

export default function LichSuDauGiaPage() {
  const {
    records,
    rawListings,
    score,
    isLoading,
    lastImport,
    importFlow,
    updateRecord,
    removeRecord,
    openImport,
    closeImport,
    handleImportFile,
    executeImport,
    setImportDuplicateStrategy,
  } = useAuctionHistory()

  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogRecords, setDialogRecords] = useState<AuctionRecord[]>([])
  const [dialogIndex, setDialogIndex] = useState(0)
  const [detailRecord, setDetailRecord] = useState<AuctionRecordWithComputed | null>(null)
  const [detailListing, setDetailListing] = useState<Record<string, unknown> | null>(null)

  const needsFillRecords = records.filter((r) => !r.enrichmentStatus.hasWinningPrice && r.isSuccessful !== false)
  const missingPriceCount = needsFillRecords.length
  const successCount = records.filter((r) => r.isSuccessful === true).length

  const handleOpenEdit = (record: AuctionRecord) => {
    setDialogRecords([record])
    setDialogIndex(0)
    setDialogOpen(true)
  }

  const handleDialogSave = (record: AuctionRecord) => {
    updateRecord(record)
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Xóa cuộc đấu giá này?')) removeRecord(id)
  }

  const handleBulkDelete = (ids: string[]) => {
    if (window.confirm(`Xóa ${ids.length} cuộc đấu giá?`)) ids.forEach(removeRecord)
  }

  const handleGoToNeedsFill = () => {
    setActiveTab('needs_fill')
    setDialogRecords(needsFillRecords)
    setDialogIndex(0)
    setDialogOpen(true)
  }

  const isImportOpen = importFlow.step !== 'idle'

  return (
    <div className="px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Lịch sử đấu giá</h1>
          <div className="flex items-center gap-1.5">
            {!isLoading && records.length > 0 && (
              <ScoreInlineBar label={`Mục IV.1-4 · Năm ${score.year}`} score={score.total} max={score.maxTotal} />
            )}
            <ScoreBreakdownDialog data={MUC_IV14_BREAKDOWN} />
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={openImport}
            disabled={records.length === 0}
          >
            <Upload className="h-4 w-4" />Bổ sung hàng loạt
          </Button>
        </div>
      </div>

      {/* Stats breakdown */}
      {!isLoading && records.length > 0 && <AuctionStatsCards score={score} />}

      {/* Missing price alert */}
      {!isLoading && <EnrichmentAlertBanner count={missingPriceCount} onGoToTab={handleGoToNeedsFill} />}

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Loader2 className="h-10 w-10 text-primary animate-spin" />
          <p className="text-sm font-medium">Đang tải lịch sử đấu giá...</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && records.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="text-4xl">📋</div>
          <div>
            <p className="text-sm font-medium">Chưa có dữ liệu đấu giá</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Các cuộc đấu giá của tổ chức bạn sẽ được hiển thị tự động tại đây sau khi được đăng trên hệ thống.
            </p>
          </div>
        </div>
      )}

      {/* Data view */}
      {!isLoading && records.length > 0 && (
        <AuctionTable
          records={records}
          activeTab={activeTab}
          onTabChange={(tab) => { setActiveTab(tab) }}
          onQuickFill={(r) => {
            setDialogRecords([r])
            setDialogIndex(0)
            setDialogOpen(true)
          }}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          onOpenDetail={(r) => { setDetailRecord(r); setDetailListing(rawListings[r.id] ?? null) }}
        />
      )}

      {/* Dialogs */}
      <AuctionRecordDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        records={dialogRecords}
        initialIndex={Math.min(dialogIndex, Math.max(0, dialogRecords.length - 1))}
        onSave={handleDialogSave}
        rawListings={rawListings}
      />

      <AuctionDetailDrawer
        open={!!detailRecord}
        onClose={() => { setDetailRecord(null); setDetailListing(null) }}
        record={detailRecord}
        rawListing={detailListing}
        onEdit={(r) => { setDetailRecord(null); setDetailListing(null); handleOpenEdit(r) }}
      />

      <ImportDialog
        open={isImportOpen}
        onClose={closeImport}
        importFlow={importFlow}
        missingPriceCount={missingPriceCount}
        onFile={handleImportFile}
        onExecuteImport={executeImport}
        onBack={openImport}
        onEnrich={handleGoToNeedsFill}
        setDuplicateStrategy={setImportDuplicateStrategy}
      />
    </div>
  )
}
