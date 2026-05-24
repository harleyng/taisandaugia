import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Search, CalendarIcon, X } from 'lucide-react'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { ASSET_CATEGORY_LABELS, type AssetCategory } from '@/types/auction-record'


export interface AuctionFilters {
  search: string
  dateFrom: string
  dateTo: string
  assetCategory: string
  legalStatus: string
  source: string
}

interface Props {
  filters: AuctionFilters
  onFiltersChange: (filters: AuctionFilters) => void
  availableLegalStatuses: string[]
}

export function AuctionFilterBar({ filters, onFiltersChange, availableLegalStatuses }: Props) {
  const [calendarOpen, setCalendarOpen] = useState(false)
  const set = (key: keyof AuctionFilters) => (value: string) =>
    onFiltersChange({ ...filters, [key]: value })

  const dateRange: DateRange = {
    from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
    to: filters.dateTo ? new Date(filters.dateTo) : undefined,
  }

  const hasDateFilter = filters.dateFrom || filters.dateTo

  const dateLabel = hasDateFilter
    ? [
        filters.dateFrom ? format(new Date(filters.dateFrom), 'dd/MM/yyyy') : '...',
        filters.dateTo ? format(new Date(filters.dateTo), 'dd/MM/yyyy') : '...',
      ].join(' – ')
    : 'Thời gian'

  const handleDateSelect = (range: DateRange | undefined) => {
    onFiltersChange({
      ...filters,
      dateFrom: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
      dateTo: range?.to ? format(range.to, 'yyyy-MM-dd') : '',
    })
    if (range?.from && range?.to) setCalendarOpen(false)
  }

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

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-10 gap-1.5 text-sm font-normal ${hasDateFilter ? 'border-primary text-primary' : 'text-muted-foreground'}`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {dateLabel}
            {hasDateFilter && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); onFiltersChange({ ...filters, dateFrom: '', dateTo: '' }) }}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={handleDateSelect}
            numberOfMonths={2}
            initialFocus
          />
        </PopoverContent>
      </Popover>

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

      {availableLegalStatuses.length > 0 && (
        <Select value={filters.legalStatus} onValueChange={set('legalStatus')}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Loại pháp lý" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả pháp lý</SelectItem>
            {availableLegalStatuses.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={filters.source} onValueChange={set('source')}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Nguồn" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tất cả nguồn</SelectItem>
          <SelectItem value="AUTO">Tự động</SelectItem>
          <SelectItem value="USER_VERIFIED">Đã xác thực</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
