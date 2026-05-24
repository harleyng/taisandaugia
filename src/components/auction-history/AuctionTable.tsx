import { useState, useMemo } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { AuctionRow } from './AuctionRow'
import { AuctionFilterBar, type AuctionFilters } from './AuctionFilterBar'
import { BulkActionBar } from './BulkActionBar'
import type { AuctionRecordWithComputed } from '@/types/auction-record'
import { History } from 'lucide-react'

type TabKey = 'all' | 'successful' | 'needs_fill' | 'failed'

interface Props {
  records: AuctionRecordWithComputed[]
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  onQuickFill: (record: AuctionRecordWithComputed) => void
  onDelete: (id: string) => void
  onBulkDelete: (ids: string[]) => void
  onOpenDetail: (record: AuctionRecordWithComputed) => void
}

const DEFAULT_FILTERS: AuctionFilters = { search: '', dateFrom: '', dateTo: '', assetCategory: 'all', legalStatus: 'all', source: 'all' }

export function AuctionTable({ records, activeTab, onTabChange, onQuickFill, onDelete, onBulkDelete, onOpenDetail }: Props) {
  const [filters, setFilters] = useState<AuctionFilters>(DEFAULT_FILTERS)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const availableLegalStatuses = useMemo(() => {
    const statuses = new Set(records.map((r) => r.legalStatus).filter(Boolean) as string[])
    return Array.from(statuses).sort()
  }, [records])

  const byTab: Record<TabKey, AuctionRecordWithComputed[]> = useMemo(() => ({
    all: records,
    successful: records.filter((r) => r.isSuccessful === true),
    needs_fill: records.filter((r) => !r.enrichmentStatus.hasWinningPrice && r.isSuccessful !== false),
    failed: records.filter((r) => r.isSuccessful === false),
  }), [records])

  const filtered = useMemo(() => {
    return byTab[activeTab].filter((r) => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!r.assetDescription.toLowerCase().includes(q) && !r.ownerName.toLowerCase().includes(q)) return false
      }
      if (filters.dateFrom && r.auctionDate < filters.dateFrom) return false
      if (filters.dateTo && r.auctionDate > filters.dateTo) return false
      if (filters.assetCategory !== 'all' && r.assetCategory !== filters.assetCategory) return false
      if (filters.legalStatus !== 'all' && r.legalStatus !== filters.legalStatus) return false
      if (filters.source !== 'all' && r.badgeSource !== filters.source) return false
      return true
    })
  }, [byTab, activeTab, filters])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map((r) => r.id)))
  }

  const tabLabel = (key: TabKey, label: string) => `${label} ${byTab[key].length}`

  return (
    <div className="space-y-3">
      <Tabs value={activeTab} onValueChange={(v) => { onTabChange(v as TabKey); setSelectedIds(new Set()) }}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="all" className="text-xs">{tabLabel('all', 'Tất cả')}</TabsTrigger>
          <TabsTrigger value="needs_fill" className="text-xs">{tabLabel('needs_fill', 'Cần bổ sung')}</TabsTrigger>
          <TabsTrigger value="successful" className="text-xs">{tabLabel('successful', 'Thành')}</TabsTrigger>
          <TabsTrigger value="failed" className="text-xs">{tabLabel('failed', 'Không thành')}</TabsTrigger>
        </TabsList>
      </Tabs>

      <AuctionFilterBar filters={filters} onFiltersChange={setFilters} availableLegalStatuses={availableLegalStatuses} />

      <BulkActionBar
        selectedCount={selectedIds.size}
        onBulkFill={() => { /* handled by page */ }}
        onBulkDelete={() => { onBulkDelete(Array.from(selectedIds)); setSelectedIds(new Set()) }}
        onExport={() => { /* TODO */ }}
      />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <History className="h-10 w-10" />
          <p className="text-sm">Không có cuộc đấu giá nào phù hợp</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 w-10">
                  <Checkbox
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-2">Ngày</th>
                <th className="px-3 py-2">Cuộc đấu giá</th>
                <th className="px-3 py-2">Người có TS</th>
                <th className="px-3 py-2 text-right">Giá KĐ</th>
                <th className="px-3 py-2 text-right">Giá trúng</th>
                <th className="px-3 py-2 text-right">Chênh lệch</th>
                <th className="px-3 py-2">Nguồn</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <AuctionRow
                  key={r.id}
                  record={r}
                  selected={selectedIds.has(r.id)}
                  onSelect={toggleSelect}
                  onQuickFill={onQuickFill}
                  onDelete={onDelete}
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
