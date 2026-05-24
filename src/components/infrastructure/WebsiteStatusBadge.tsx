import { useState } from 'react'
import { CheckCircle2, Loader2, XCircle, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  url: string
  isReachable?: boolean
  lastChecked?: string
  onCheck: (reachable: boolean) => void
}

export function WebsiteStatusBadge({ url, isReachable, lastChecked, onCheck }: Props) {
  const [checking, setChecking] = useState(false)

  async function handleCheck() {
    if (!url) return
    setChecking(true)
    // Mock: mark as reachable after short delay (no server-side ping)
    await new Promise((r) => setTimeout(r, 800))
    onCheck(true)
    setChecking(false)
  }

  const lastCheckedLabel = lastChecked
    ? (() => {
        const diffH = Math.floor((Date.now() - new Date(lastChecked).getTime()) / 3600000)
        if (diffH === 0) return 'vừa kiểm tra'
        if (diffH < 24) return `${diffH} giờ trước`
        return `${Math.floor(diffH / 24)} ngày trước`
      })()
    : null

  return (
    <div className="flex items-center gap-2">
      {isReachable === true && (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
          <CheckCircle2 className="h-3 w-3" />
          Đang hoạt động
          {lastCheckedLabel && (
            <span className="text-green-600 font-normal"> · {lastCheckedLabel}</span>
          )}
        </span>
      )}
      {isReachable === false && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          <XCircle className="h-3 w-3" />
          Không hoạt động
        </span>
      )}
      {isReachable === undefined && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          <HelpCircle className="h-3 w-3" />
          Chưa kiểm tra
        </span>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={handleCheck}
        disabled={!url || checking}
      >
        {checking ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Kiểm tra'}
      </Button>
    </div>
  )
}
