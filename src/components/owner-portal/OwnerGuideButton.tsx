import { useLocation } from 'react-router-dom'
import { CircleHelp } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ownerGuideUrl } from './owner-guide-links'

/** Nút "?" góc dưới phải — mở mục hướng dẫn của trang đang xem ở tab mới. Trang chưa có hướng dẫn thì ẩn. */
export function OwnerGuideButton() {
  const { pathname } = useLocation()
  const href = ownerGuideUrl(pathname)
  if (!href) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Hướng dẫn tính năng này (mở tab mới)"
          className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-primary shadow-lg transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <CircleHelp className="h-5 w-5" aria-hidden />
        </a>
      </TooltipTrigger>
      <TooltipContent side="left">Hướng dẫn tính năng này</TooltipContent>
    </Tooltip>
  )
}
