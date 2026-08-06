import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Search, MoreVertical, Pencil, Trash2, ChevronDown, AlertTriangle, IdCard } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { AuctioneerWithComputed, Position, BadgeSource } from '@/types/auctioneer'
import { POSITION_LABELS, CONTRACT_TYPE_LABELS } from '@/types/auctioneer'
import { SourceBadge } from './SourceBadge'

interface Props {
  auctioneers: AuctioneerWithComputed[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'
type PositionFilter = 'ALL' | Position
type SourceFilter = 'ALL' | BadgeSource

export function AuctioneerTable({ auctioneers, onEdit, onDelete }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('ALL')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL')

  const filtered = useMemo(() => {
    return auctioneers.filter((a) => {
      if (search) {
        const q = search.toLowerCase()
        if (
          !a.fullName.toLowerCase().includes(q) &&
          !a.licenseNumber.toLowerCase().includes(q)
        )
          return false
      }
      if (statusFilter === 'ACTIVE' && !a.isActive) return false
      if (statusFilter === 'INACTIVE' && a.isActive) return false
      if (positionFilter !== 'ALL' && a.position !== positionFilter) return false
      if (sourceFilter !== 'ALL' && a.badgeSource !== sourceFilter) return false
      return true
    })
  }, [auctioneers, search, statusFilter, positionFilter, sourceFilter])

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên, số thẻ..."
            className="pl-8 h-8 text-sm"
          />
        </div>

        <FilterDropdown
          label="Nguồn"
          value={sourceFilter}
          options={[
            { value: 'ALL', label: 'Tất cả nguồn' },
            { value: 'AUTO', label: 'Tự động' },
            { value: 'USER_VERIFIED', label: 'Đã xác thực' },
          ]}
          onChange={(v) => setSourceFilter(v as SourceFilter)}
        />

        <FilterDropdown
          label="Trạng thái"
          value={statusFilter}
          options={[
            { value: 'ALL', label: 'Tất cả' },
            { value: 'ACTIVE', label: 'Đang hành nghề' },
            { value: 'INACTIVE', label: 'Đã nghỉ' },
          ]}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
        />

        <FilterDropdown
          label="Chức vụ"
          value={positionFilter}
          options={[
            { value: 'ALL', label: 'Tất cả chức vụ' },
            ...Object.entries(POSITION_LABELS).map(([v, l]) => ({ value: v, label: l })),
          ]}
          onChange={(v) => setPositionFilter(v as PositionFilter)}
        />
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length}/{auctioneers.length} đấu giá viên
      </p>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Không tìm thấy đấu giá viên phù hợp
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <AuctioneerRow key={a.id} auctioneer={a} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

function AuctioneerRow({
  auctioneer: a,
  onEdit,
  onDelete,
}: {
  auctioneer: AuctioneerWithComputed
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const navigate = useNavigate()
  const expiryWarning =
    a.daysUntilLicenseExpiry !== undefined && a.daysUntilLicenseExpiry < 60

  return (
    <Card className={`px-4 py-3 ${!a.isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Row 1: name + badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className="text-sm font-medium">{a.fullName}</span>
            <SourceBadge source={a.badgeSource} size="xs" />
            {!a.isActive && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground">
                Đã nghỉ
              </Badge>
            )}
          </div>

          {/* Row 2: details */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Thẻ {a.licenseNumber}</span>
            <span>{POSITION_LABELS[a.position]}</span>
            <span>{CONTRACT_TYPE_LABELS[a.contractType]}</span>
            <span className={a.yearsOfExperience >= 5 ? 'text-primary font-medium' : ''}>
              {a.yearsOfExperience} năm KN
            </span>
            {expiryWarning && (
              <span className="flex items-center gap-1 text-warning font-medium">
                <AlertTriangle className="h-3 w-3" />
                Thẻ hết hạn {a.daysUntilLicenseExpiry}n
              </span>
            )}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => navigate(`/portal/nang-luc/dau-gia-vien/${a.id}`)}
              className="gap-2"
            >
              <IdCard className="h-3.5 w-3.5" /> Mở hồ sơ
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(a.id)} className="gap-2">
              <Pencil className="h-3.5 w-3.5" /> Sửa nhanh
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(a.id)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" /> Xoá
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  )
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  const current = options.find((o) => o.value === value)
  const isFiltered = value !== 'ALL'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 gap-1 text-xs ${isFiltered ? 'border-primary text-primary' : ''}`}
        >
          {isFiltered ? current?.label : label}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
