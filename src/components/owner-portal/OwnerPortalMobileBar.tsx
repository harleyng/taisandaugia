import { Menu } from 'lucide-react'
import { useOwnerPortalName } from '@/hooks/useOwnerPortalName'

interface Props {
  onMenuClick: () => void
}

/**
 * Thanh mảnh chỉ hiện trên mobile để mở sidebar. Desktop không có top bar: credit
 * và hồ sơ nằm ở chân sidebar, mỗi trang tự có tiêu đề (OwnerPageHeader).
 */
export function OwnerPortalMobileBar({ onMenuClick }: Props) {
  const portalName = useOwnerPortalName()

  return (
    <header className="lg:hidden flex h-12 items-center gap-2 border-b border-border bg-background px-3 shrink-0">
      <button
        className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted"
        onClick={onMenuClick}
        aria-label="Mở menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <span className="truncate text-sm font-semibold text-foreground">{portalName}</span>
    </header>
  )
}
