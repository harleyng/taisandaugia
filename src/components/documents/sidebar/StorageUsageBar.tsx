import { STORAGE_LIMIT_BYTES } from '@/types/document'
import { Progress } from '@/components/ui/progress'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

interface Props {
  usedBytes: number
}

export function StorageUsageBar({ usedBytes }: Props) {
  const pct = Math.min(100, Math.round((usedBytes / STORAGE_LIMIT_BYTES) * 100))
  const isWarning = pct >= 80
  const isFull = pct >= 100

  return (
    <div className="px-2 space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Dung lượng</span>
        <span className={isFull ? 'text-destructive font-medium' : ''}>
          {formatBytes(usedBytes)} / {formatBytes(STORAGE_LIMIT_BYTES)}
        </span>
      </div>
      <Progress
        value={pct}
        className={
          isFull
            ? '[&>div]:bg-destructive'
            : isWarning
              ? '[&>div]:bg-amber-500'
              : ''
        }
      />
      {isWarning && !isFull && (
        <p className="text-xs text-amber-600">
          Gần đạt giới hạn — dọn thùng rác để giải phóng dung lượng.
        </p>
      )}
      {isFull && (
        <p className="text-xs text-destructive">
          Đã đầy — không thể tải thêm file.
        </p>
      )}
    </div>
  )
}
