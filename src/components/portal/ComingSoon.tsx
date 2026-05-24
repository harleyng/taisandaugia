import { Badge } from '@/components/ui/badge'
import { Construction } from 'lucide-react'

interface Props {
  title: string
  description: string
  score?: string
}

export function ComingSoon({ title, description, score }: Props) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-base font-bold text-foreground">{title}</h1>
        {score && (
          <Badge variant="secondary" className="text-xs">
            Tối đa {score}
          </Badge>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/20 px-8 py-16 text-center">
        <Construction className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
        <p className="text-sm font-medium text-foreground">Đang xây dựng</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">{description}</p>
      </div>
    </div>
  )
}
