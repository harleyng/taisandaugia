import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface Props {
  amount: number
  className?: string
}

export function AmountDisplay({ amount, className }: Props) {
  const [revealed, setRevealed] = useState(false)

  const formatted = new Intl.NumberFormat('vi-VN').format(amount) + ' VND'

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-sm ${className ?? ''}`}>
      {revealed ? formatted : '••• VND'}
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        aria-label={revealed ? 'Ẩn số tiền' : 'Hiện số tiền'}
      >
        {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </span>
  )
}
