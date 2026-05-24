import { Progress } from '@/components/ui/progress'
import { Loader2 } from 'lucide-react'

interface Props {
  progress: number
  total: number
}

export function ImportProgressStep({ progress, total }: Props) {
  const done = Math.round((progress / 100) * total)
  return (
    <div className="text-center space-y-6 py-6">
      <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
      <div className="space-y-2">
        <p className="text-sm font-medium">Đang import...</p>
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground">
          {done}/{total} dòng · {progress}%
        </p>
      </div>
      <p className="text-xs text-muted-foreground">Không đóng tab này trong khi đang import</p>
    </div>
  )
}
