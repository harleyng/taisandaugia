import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTaxRecords } from '@/hooks/useTaxRecords'
import type { TaxRecord } from '@/types/tax'
import { TaxScoreSummary } from '@/components/tax/TaxScoreSummary'
import { TargetYearBanner } from '@/components/tax/TargetYearBanner'
import { YearListTimeline } from '@/components/tax/YearListTimeline'
import { EmptyState } from '@/components/tax/EmptyState'
import { TaxRecordForm } from '@/components/tax/TaxRecordForm'

export default function TaiChinhPage() {
  const {
    records,
    targetYear,
    targetRecord,
    scoreIV9,
    defaultRecordType,
    addRecord,
    updateRecord,
    deleteRecord,
  } = useTaxRecords()

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const hasData = records.length > 0
  const existingToEdit = editingId ? records.find((r) => r.id === editingId) : undefined
  const existingYears = records.map((r) => r.year)

  const handleAdd = () => {
    setEditingId(null)
    setFormOpen(true)
  }

  const handleEdit = (record: TaxRecord) => {
    setEditingId(record.id)
    setFormOpen(true)
  }

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open)
    if (!open) setEditingId(null)
  }

  const handleSave = (record: TaxRecord) => {
    if (editingId) {
      updateRecord(record)
    } else {
      addRecord(record)
    }
    setEditingId(null)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-foreground">Tài chính & Thuế</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Mục IV.9 Phụ lục I · Tối đa 3 điểm · Năm tính điểm: {targetYear}
          </p>
        </div>
        <Button size="sm" className="gap-1.5 shrink-0" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Thêm số liệu
        </Button>
      </div>

      <TargetYearBanner targetYear={targetYear} />

      <TaxScoreSummary
        score={scoreIV9}
        targetYear={targetYear}
        targetRecord={targetRecord}
      />

      {hasData ? (
        <YearListTimeline
          records={records}
          targetYear={targetYear}
          onEdit={handleEdit}
          onDelete={deleteRecord}
        />
      ) : (
        <EmptyState targetYear={targetYear} onAdd={handleAdd} />
      )}

      <TaxRecordForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        existing={existingToEdit}
        defaultYear={targetYear}
        defaultRecordType={defaultRecordType}
        existingYears={editingId ? existingYears.filter((y) => y !== existingToEdit?.year) : existingYears}
        onSave={handleSave}
      />
    </div>
  )
}
