import { ChevronRight, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Folder } from '@/types/document'

interface Props {
  path: Folder[]
  onNavigate: (folderId: string | null) => void
}

export function FolderBreadcrumb({ path, onNavigate }: Props) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <Home className="h-3.5 w-3.5" />
        <span>Tủ tài liệu</span>
      </button>

      {path.map((folder) => (
        <span key={folder.id} className="flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          <button
            onClick={() => onNavigate(folder.id)}
            className="hover:text-foreground transition-colors truncate max-w-32"
          >
            {folder.name}
          </button>
        </span>
      ))}
    </nav>
  )
}
