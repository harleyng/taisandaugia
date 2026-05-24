import { differenceInDays, format, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'

interface Props {
  expiryDate?: string
}

export function ExpiryBadge({ expiryDate }: Props) {
  if (!expiryDate) return null
  const days = differenceInDays(parseISO(expiryDate), new Date())
  const label = format(parseISO(expiryDate), 'dd/MM/yyyy', { locale: vi })

  if (days < 0)
    return (
      <Badge variant="destructive" className="text-xs">
        Đã hết hạn {format(parseISO(expiryDate), 'dd/MM', { locale: vi })}
      </Badge>
    )
  if (days <= 30)
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
        Hết hạn {days} ngày
      </Badge>
    )
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      HH: {label}
    </Badge>
  )
}
