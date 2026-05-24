import { AlertTriangle, Star, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentFilter } from '@/types/document'

interface Props {
  filter: DocumentFilter
  setFilter: (patch: Partial<DocumentFilter>) => void
  expiringCount: number
}

interface FilterItem {
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}

export function QuickFilters({ filter, setFilter, expiringCount }: Props) {
  const isAll = !filter.showTrashed && !filter.showStarred && filter.folderId === null

  const items: FilterItem[] = [
    {
      label: 'Tất cả',
      icon: null,
      active: isAll,
      onClick: () =>
        setFilter({ showTrashed: false, showStarred: false, folderId: null }),
    },
    {
      label: 'Đã đánh dấu',
      icon: <Star className="h-3.5 w-3.5" />,
      active: filter.showStarred,
      onClick: () =>
        setFilter({ showStarred: !filter.showStarred, showTrashed: false }),
    },
    {
      label: expiringCount > 0 ? `Sắp hết hạn (${expiringCount})` : 'Sắp hết hạn',
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      active: false,
      onClick: () =>
        setFilter({ showTrashed: false, showStarred: false, folderId: null }),
    },
    {
      label: 'Thùng rác',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      active: filter.showTrashed,
      onClick: () =>
        setFilter({ showTrashed: !filter.showTrashed, showStarred: false }),
    },
  ]

  return (
    <div className="space-y-0.5">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.onClick}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md text-left transition-colors',
            item.active
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}
