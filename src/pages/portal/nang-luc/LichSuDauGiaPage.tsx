import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, Loader2 } from 'lucide-react'
import { useAuctionHistory } from '@/hooks/useAuctionHistory'
import { AuctionStatsCards } from '@/components/auction-history/AuctionStatsCards'
import { EnrichmentAlertBanner } from '@/components/auction-history/EnrichmentAlertBanner'
import { AuctionTable } from '@/components/auction-history/AuctionTable'
import { QuickFillForm } from '@/components/auction-history/QuickFillForm'
import { AuctionEnrichDialog } from '@/components/auction-history/AuctionEnrichDialog'
import { AuctionDetailDrawer } from '@/components/auction-history/AuctionDetailDrawer'
import { ImportDialog } from '@/components/auction-history/import/ImportDialog'
import type { AuctionRecordWithComputed, AuctionRecord } from '@/types/auction-record'
import type { ColumnMapping } from '@/lib/auction-history/import-parser'

type TabKey = 'all' | 'complete' | 'needs_fill' | 'failed'

export default function LichSuDauGiaPage() {
  const {
    records,
    score,
    isLoading,
    lastImport,
    importFlow,
    updateRecord,
    removeRecord,
    openImport,
    closeImport,
    handleImportFile,
    confirmMapping,
    executeImport,
    setImportDuplicateStrategy,
  } = useAuctionHistory()

  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [enrichOpen, setEnrichOpen] = useState(false)
  const [editRecord, setEditRecord] = useState<AuctionRecord | undefined>()
  const [detailRecord, setDetailRecord] = useState<AuctionRecordWithComputed | null>(null)
  const [quickFillIndex, setQuickFillIndex] = useState(0)
  const [showQuickFill, setShowQuickFill] = useState(false)

  const needsFillRecords = records.filter((r) => !r.enrichmentStatus.hasWinningPrice && r.isSuccessful !== false)
  const missingPriceCount = needsFillRecords.length
  const successCount = records.filter((r) => r.isSuccessful === true).length

  const handleOpenEnrich = (record: AuctionRecordWithComputed) => {
    setEditRecord(record)
    setEnrichOpen(true)
  }

  const handleSaveEnrich = (record: AuctionRecord) => {
    updateRecord(record)
    setEnrichOpen(false)
    setEditRecord(undefined)
  }

  const handleDelete = (id: string) => {
    if (window.confirm('Xóa cuộc đấu giá này?')) removeRecord(id)
  }

  const handleBulkDelete = (ids: string[]) => {
    if (window.confirm(`Xóa ${ids.length} cuộc đấu giá?`)) ids.forEach(removeRecord)
  }

  const handleGoToNeedsFill = () => {
    setActiveTab('needs_fill')
    setShowQuickFill(true)
    setQuickFillIndex(0)
  }

  const handleQuickFillSave = (record: AuctionRecord) => {
    updateRecord(record)
    if (quickFillIndex < needsFillRecords.length - 1) {
      setQuickFillIndex((i) => i + 1)
    } else {
      setShowQuickFill(false)
    }
  }

  const handleQuickFillSkip = () => {
    if (quickFillIndex < needsFillRecords.length - 1) {
      setQuickFillIndex((i) => i + 1)
    } else {
      setShowQuickFill(false)
    }
  }

  const isImportOpen = importFlow.step !== 'idle'

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Hồ sơ năng lực › Lịch sử đấu giá</p>
          <h1 className="text-xl font-semibold mt-0.5">Lịch sử đấu giá</h1>
          {isLoading ? (
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />Đang tải dữ liệu...
            </p>
          ) : records.length > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {records.length} cuộc · {successCount} thành công
              {missingPriceCount > 0 && ` · ${missingPriceCount} cần bổ sung`}
            </p>
          )}
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

      {/* Stats (only when records exist) */}
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
        <div className="space-y-4">
          {activeTab === 'needs_fill' && showQuickFill && needsFillRecords.length > 0 && (
            <QuickFillForm
              records={needsFillRecords}
              currentIndex={Math.min(quickFillIndex, needsFillRecords.length - 1)}
              onSave={handleQuickFillSave}
              onSkip={handleQuickFillSkip}
            />
          )}

          <AuctionTable
            records={records}
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab)
              if (tab === 'needs_fill') {
                setQuickFillIndex(0)
                setShowQuickFill(true)
              } else {
                setShowQuickFill(false)
              }
            }}
            onEdit={handleOpenEnrich}
            onQuickFill={(r) => {
              const idx = needsFillRecords.findIndex((n) => n.id === r.id)
              setQuickFillIndex(Math.max(0, idx))
              setActiveTab('needs_fill')
              setShowQuickFill(true)
            }}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            onOpenDetail={setDetailRecord}
          />
        </div>
      )}

      {/* Dialogs */}
      <AuctionEnrichDialog
        open={enrichOpen}
        onClose={() => { setEnrichOpen(false); setEditRecord(undefined) }}
        record={editRecord}
        onSave={handleSaveEnrich}
      />

      <AuctionDetailDrawer
        open={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        record={detailRecord}
        onEdit={(r) => { setDetailRecord(null); handleOpenEnrich(r) }}
      />

      <ImportDialog
        open={isImportOpen}
        onClose={closeImport}
        importFlow={importFlow}
        missingPriceCount={missingPriceCount}
        onFile={handleImportFile}
        onConfirmMapping={(mapping: ColumnMapping) => confirmMapping(mapping)}
        onExecuteImport={executeImport}
        onGoToMapping={openImport}
        onEnrich={handleGoToNeedsFill}
        setDuplicateStrategy={setImportDuplicateStrategy}
      />
    </div>
  )
}
