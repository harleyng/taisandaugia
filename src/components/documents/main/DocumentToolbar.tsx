import {
  FolderPlus,
  Grid3X3,
  List,
  SortAsc,
  SortDesc,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SortField, ViewMode } from '@/types/document'
import type { UseDocumentsReturn } from '@/hooks/useDocuments'

interface Props {
  docs: UseDocumentsReturn
  onUpload: () => void
  onNewFolder: () => void
}

const SORT_LABELS: Record<SortField, string> = {
  updatedAt: 'Mới nhất',
  name: 'Tên A-Z',
  sizeBytes: 'Kích thước',
  expiryDate: 'Hết hạn sớm',
}

export function DocumentToolbar({ docs, onUpload, onNewFolder }: Props) {
  const { filter, viewMode, setFilter, setViewMode } = docs

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button onClick={onUpload} size="sm" className="gap-2">
        <Upload className="h-4 w-4" />
        Tải lên
      </Button>

      <Button onClick={onNewFolder} variant="outline" size="sm" className="gap-2">
        <FolderPlus className="h-4 w-4" />
        Folder mới
      </Button>

      <div className="flex-1" />

      <Select
        value={filter.sortField}
        onValueChange={(v) => setFilter({ sortField: v as SortField })}
      >
        <SelectTrigger className="h-8 w-36 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABELS) as SortField[]).map((k) => (
            <SelectItem key={k} value={k} className="text-xs">
              {SORT_LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() =>
          setFilter({ sortDir: filter.sortDir === 'asc' ? 'desc' : 'asc' })
        }
      >
        {filter.sortDir === 'asc' ? (
          <SortAsc className="h-4 w-4" />
        ) : (
          <SortDesc className="h-4 w-4" />
        )}
      </Button>

      <div className="flex border rounded-md">
        <Button
          variant={viewMode === 'list' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8 rounded-r-none"
          onClick={() => setViewMode('list')}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8 rounded-l-none border-l"
          onClick={() => setViewMode('grid')}
        >
          <Grid3X3 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
