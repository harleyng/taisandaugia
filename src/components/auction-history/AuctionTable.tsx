import { useState, useMemo } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { AuctionRow } from './AuctionRow'
import { AuctionFilterBar, type AuctionFilters } from './AuctionFilterBar'
import { BulkActionBar } from './BulkActionBar'
import type { AuctionRecordWithComputed } from '@/types/auction-record'
import { History } from 'lucide-react'

type TabKey = 'all' | 'complete' | 'needs_fill' | 'failed'

interface Props {
  records: AuctionRecordWithComputed[]
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  onEdit: (record: AuctionRecordWithComputed) => void
  onQuickFill: (record: AuctionRecordWithComputed) => void
  onDelete: (id: string) => void
  onBulkDelete: (ids: string[]) => void
  onOpenDetail: (record: AuctionRecordWithComputed) => void
}

const DEFAULT_FILTERS: AuctionFilters = { search: '', year: 'all', assetCategory: 'all', source: 'all', status: 'all' }

export function AuctionTable({ records, activeTab, onTabChange, onEdit, onQuickFill, onDelete, onBulkDelete, onOpenDetail }: Props) {
  const [filters, setFilters] = useState<AuctionFilters>(DEFAULT_FILTERS)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const availableYears = useMemo(() => {
    const years = new Set(records.map((r) => new Date(r.auctionDate).getFullYear()))
    return Array.from(years).sort((a, b) => b - a)
  }, [records])

  const byTab: Record<TabKey, AuctionRecordWithComputed[]> = useMemo(() => ({
    all: records,
    complete: records.filter((r) => r.enrichmentStatus.hasWinningPrice && r.enrichmentStatus.hasFormat),
    needs_fill: records.filter((r) => !r.enrichmentStatus.hasWinningPrice && r.isSuccessful !== false),
    failed: records.filter((r) => r.isSuccessful === false),
  }), [records])

  const filtered = useMemo(() => {
    return byTab[activeTab].filter((r) => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!r.assetDescription.toLowerCase().includes(q) && !r.ownerName.toLowerCase().includes(q)) return false
      }
      if (filters.year !== 'all' && new Date(r.auctionDate).getFullYear() !== Number(filters.year)) return false
      if (filters.assetCategory !== 'all' && r.assetCategory !== filters.assetCategory) return false
      if (filters.source !== 'all') {
        const src = r.source.startsWith('CRAWLED') ? 'CRAWLED' : r.source
        if (src !== filters.source) return false
      }
      if (filters.status !== 'all') {
        if (filters.status === 'successful' && r.isSuccessful !== true) return false
        if (filters.status === 'failed' && r.isSuccessful !== false) return false
        if (filters.status === 'unknown' && r.isSuccessful !== undefined) return false
      }
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
          <TabsTrigger value="complete" className="text-xs">{tabLabel('complete', 'Đầy đủ')}</TabsTrigger>
          <TabsTrigger value="needs_fill" className="text-xs">{tabLabel('needs_fill', 'Cần bổ sung')}</TabsTrigger>
          <TabsTrigger value="failed" className="text-xs">{tabLabel('failed', 'Không thành')}</TabsTrigger>
        </TabsList>
      </Tabs>

      <AuctionFilterBar filters={filters} onFiltersChange={setFilters} availableYears={availableYears} />

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
                <th className="px-3 py-2">STT</th>
                <th className="px-3 py-2">Ngày</th>
                <th className="px-3 py-2">Tài sản</th>
                <th className="px-3 py-2">Người có TS</th>
                <th className="px-3 py-2 text-right">Giá KĐ</th>
                <th className="px-3 py-2 text-right">Giá trúng</th>
                <th className="px-3 py-2 text-right">Chênh lệch</th>
                <th className="px-3 py-2">Hình thức</th>
                <th className="px-3 py-2">Nguồn</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <AuctionRow
                  key={r.id}
                  record={r}
                  index={i}
                  selected={selectedIds.has(r.id)}
                  onSelect={toggleSelect}
                  onEdit={onEdit}
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
