import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SuggestionSection } from '@/lib/applications/suggestions'
import { Copy } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  suggestion: SuggestionSection
  onCopy: (text: string) => void
}

export function SuggestionsModal({ open, onOpenChange, suggestion, onCopy }: Props) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const text = suggestion.items.map((item) => `• ${item}`).join('\n')
    onCopy(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">💡 {suggestion.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground text-xs">Các nội dung nên đề cập:</p>
          <ul className="space-y-1.5">
            {suggestion.items.map((item, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary mt-0.5 shrink-0">•</span>
                <span className="text-sm">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 rounded-lg bg-muted/50 p-3 border">
            <p className="text-xs font-medium text-muted-foreground mb-1">Ví dụ tham khảo:</p>
            <p className="text-xs text-foreground leading-relaxed">{suggestion.example}</p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={handleCopy} className="flex-1">
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            {copied ? 'Đã copy!' : 'Copy gợi ý vào textarea'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
