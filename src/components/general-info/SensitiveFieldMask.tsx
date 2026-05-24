import { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SensitiveFieldMaskProps {
  value: string
  showChars?: number
}

function maskValue(value: string, showChars: number): string {
  if (value.length <= showChars) return value
  const visible = value.slice(-showChars)
  const bullets = '•'.repeat(Math.min(8, value.length - showChars))
  return bullets + visible
}

export function SensitiveFieldMask({ value, showChars = 4 }: SensitiveFieldMaskProps) {
  const [revealed, setRevealed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleReveal = () => {
    setRevealed(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setRevealed(false), 30_000)
  }

  const handleHide = () => {
    setRevealed(false)
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-sm">{revealed ? value : maskValue(value, showChars)}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
        onClick={revealed ? handleHide : handleReveal}
        title={revealed ? 'Ẩn' : 'Hiện'}
      >
        {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
    </span>
  )
}
