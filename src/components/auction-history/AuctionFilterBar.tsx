import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search } from 'lucide-react'
import { ASSET_CATEGORY_LABELS, type AssetCategory } from '@/types/auction-record'

export interface AuctionFilters {
  search: string
  year: string
  assetCategory: string
  source: string
  status: string
}

interface Props {
  filters: AuctionFilters
  onFiltersChange: (filters: AuctionFilters) => void
  availableYears: number[]
}

export function AuctionFilterBar({ filters, onFiltersChange, availableYears }: Props) {
  const set = (key: keyof AuctionFilters) => (value: string) =>
    onFiltersChange({ ...filters, [key]: value })

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Tìm tài sản, người có TS..."
          value={filters.search}
          onChange={(e) => set('search')(e.target.value)}
          className="pl-8"
        />
      </div>

      <Select value={filters.year} onValueChange={set('year')}>
        <SelectTrigger className="w-[110px]">
          <SelectValue placeholder="Năm" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả</SelectItem>
          {availableYears.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.assetCategory} onValueChange={set('assetCategory')}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Loại tài sản" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả loại TS</SelectItem>
          {(Object.entries(ASSET_CATEGORY_LABELS) as [AssetCategory, string][]).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.source} onValueChange={set('source')}>
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Nguồn" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả nguồn</SelectItem>
          <SelectItem value="CRAWLED">Cổng QG</SelectItem>
          <SelectItem value="IMPORTED">Import</SelectItem>
          <SelectItem value="MANUAL">Thủ công</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.status} onValueChange={set('status')}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Trạng thái" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả</SelectItem>
          <SelectItem value="successful">Thành công</SelectItem>
          <SelectItem value="failed">Không thành</SelectItem>
          <SelectItem value="unknown">Chưa rõ</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
