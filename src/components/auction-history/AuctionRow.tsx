import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Eye, MoreVertical, Trash2, Zap } from 'lucide-react'
import { format } from 'date-fns'
import { SourceBadge } from './SourceBadge'
import type { AuctionRecordWithComputed } from '@/types/auction-record'

function fmtVND(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' tỷ'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + ' tr'
  return n.toLocaleString('vi-VN')
}

interface Props {
  record: AuctionRecordWithComputed
  selected: boolean
  onSelect: (id: string) => void
  onQuickFill: (record: AuctionRecordWithComputed) => void
  onDelete: (id: string) => void
  onOpenDetail: (record: AuctionRecordWithComputed) => void
}

export function AuctionRow({ record, selected, onSelect, onQuickFill, onDelete, onOpenDetail }: Props) {
  const pct = record.priceDifferencePercentage
  const pctLabel = pct !== undefined
    ? <span className={`font-medium ${pct >= 10 ? 'text-success' : pct > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
        {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
      </span>
    : record.isSuccessful === false
      ? <span className="text-muted-foreground">—</span>
      : <span className="text-xs text-muted-foreground">TBC</span>

  return (
    <tr
      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={() => onOpenDetail(record)}
    >
      <td className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onCheckedChange={() => onSelect(record.id)} />
      </td>
      <td className="px-3 py-3 text-sm whitespace-nowrap">
        {(() => { try { return format(new Date(record.auctionDate), 'dd/MM/yyyy') } catch { return record.auctionDate } })()}
      </td>
      <td className="px-3 py-3 max-w-[220px]">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-sm text-left truncate block w-full">{record.assetDescription}</span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">{record.assetDescription}</TooltipContent>
        </Tooltip>
      </td>
      <td className="px-3 py-3 text-sm max-w-[120px] truncate">{record.ownerName}</td>
      <td className="px-3 py-3 text-sm tabular-nums text-right whitespace-nowrap">{fmtVND(record.startingPrice)}</td>
      <td className="px-3 py-3 text-sm tabular-nums text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
        {record.winningPrice !== undefined ? (
          <span className={record.isSuccessful === false ? 'text-muted-foreground line-through' : ''}>
            {fmtVND(record.winningPrice)}
          </span>
        ) : record.isSuccessful === false ? (
          <Badge variant="outline" className="text-xs text-destructive border-destructive/30">Không thành</Badge>
        ) : (
          <button
            className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2"
            onClick={() => onQuickFill(record)}
          >
            Chưa có +
          </button>
        )}
      </td>
      <td className="px-3 py-3 text-sm text-right">{pctLabel}</td>
      <td className="px-3 py-3">
        <SourceBadge source={record.badgeSource} />
      </td>
      <td className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onOpenDetail(record)} className="gap-2">
              <Eye className="h-4 w-4" />Xem chi tiết
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onQuickFill(record)} className="gap-2">
              <Zap className="h-4 w-4 text-amber-500" />Bổ sung thông tin
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(record.id)} className="gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />Xóa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  )
}
