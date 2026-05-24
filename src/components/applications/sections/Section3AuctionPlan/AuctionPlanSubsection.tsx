import { useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Lightbulb, ClipboardCopy } from 'lucide-react'
import { SuggestionsModal } from './SuggestionsModal'
import { SuggestionSection } from '@/lib/applications/suggestions'

interface Props {
  id: string
  title: string
  subtitle: string
  maxScore: number
  value: string
  minChars: number
  suggestion: SuggestionSection
  onChange: (value: string) => void
  onCopyFromPrevious?: () => void
}

export function AuctionPlanSubsection({
  id,
  title,
  subtitle,
  maxScore,
  value,
  minChars,
  suggestion,
  onChange,
  onCopyFromPrevious,
}: Props) {
  const [suggestOpen, setSuggestOpen] = useState(false)
  const charCount = value.length
  const progress = Math.min(charCount / minChars, 1)
  const isSufficient = charCount >= minChars

  return (
    <>
      <div className="py-5 border-b border-border last:border-0">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-foreground">{title}</h3>
              <span className="text-[10px] text-muted-foreground border border-border rounded px-1 py-px">{maxScore}đ</span>
            </div>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setSuggestOpen(true)}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Gợi ý
            </Button>
            {onCopyFromPrevious && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={onCopyFromPrevious}
              >
                <ClipboardCopy className="h-3.5 w-3.5" />
                Hồ sơ cũ
              </Button>
            )}
          </div>
        </div>

        <Textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          placeholder={`Soạn nội dung ${title.toLowerCase()}...`}
          className="bg-white resize-none focus:ring-primary/30"
        />

        {/* Word count bar */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <div className="w-24 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isSufficient ? 'bg-emerald-500' : 'bg-amber-400'}`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {charCount}/{minChars} ký tự gợi ý
            </span>
          </div>
          {isSufficient && (
            <span className="text-xs text-emerald-600 font-medium">✓ Đủ</span>
          )}
        </div>
      </div>

      <SuggestionsModal
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        suggestion={suggestion}
        onCopy={(text) => onChange(value ? `${value}\n\n${text}` : text)}
      />
    </>
  )
}
