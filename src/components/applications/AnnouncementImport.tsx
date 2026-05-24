import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  scrapeUrl,
  parseAnnouncementText,
  SCRAPE_ERROR_MESSAGES,
  ScrapeError,
} from '@/lib/applications/announcement-scraper'
import { Announcement } from '@/types/application'
import { ASSET_CATEGORY_LABELS } from '@/lib/applications/labels'
import {
  Link,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Sparkles,
} from 'lucide-react'

interface Props {
  onFilled: (data: Partial<Announcement>) => void
}

type ImportState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'success'; fieldsFound: number; data: Partial<Announcement> }
  | { phase: 'error'; error: ScrapeError; message: string }

const FIELD_LABELS: Partial<Record<keyof Announcement, string>> = {
  ownerName: 'Người có tài sản',
  assetDescription: 'Mô tả tài sản',
  assetCategory: 'Loại tài sản',
  startingPrice: 'Giá khởi điểm',
  province: 'Tỉnh/thành',
  deadline: 'Hạn nộp hồ sơ',
  announcementNumber: 'Số thông báo',
  announcementDate: 'Ngày thông báo',
  assetLocation: 'Địa chỉ tài sản',
}

function formatFieldValue(key: keyof Announcement, value: unknown): string {
  if (value === undefined || value === null || value === '') return ''
  if (key === 'startingPrice' && typeof value === 'number') {
    return value.toLocaleString('vi-VN') + ' đồng'
  }
  if (key === 'assetCategory' && typeof value === 'string') {
    return ASSET_CATEGORY_LABELS[value] ?? value
  }
  if ((key === 'deadline' || key === 'announcementDate') && typeof value === 'string') {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d.toLocaleDateString('vi-VN')
  }
  return String(value)
}

export function AnnouncementImport({ onFilled }: Props) {
  const [url, setUrl] = useState('')
  const [state, setState] = useState<ImportState>({ phase: 'idle' })
  const [pasteText, setPasteText] = useState('')
  const [showPaste, setShowPaste] = useState(false)
  const [applied, setApplied] = useState(false)

  const isPasteVisible =
    showPaste || state.phase === 'error' && state.error === 'bot_protection'

  async function handleFetch() {
    if (!url.trim()) return
    setState({ phase: 'loading' })
    setApplied(false)

    const result = await scrapeUrl(url.trim())

    if (result.ok) {
      setState({ phase: 'success', fieldsFound: result.fieldsFound, data: result.data })
    } else {
      setState({
        phase: 'error',
        error: result.error ?? 'unknown',
        message: SCRAPE_ERROR_MESSAGES[result.error ?? 'unknown'],
      })
      // Auto-show paste if bot protection
      if (result.error === 'bot_protection') setShowPaste(true)
    }
  }

  function handlePasteParse() {
    if (!pasteText.trim()) return
    const result = parseAnnouncementText(pasteText)
    if (result.ok) {
      setState({ phase: 'success', fieldsFound: result.fieldsFound, data: result.data })
    } else {
      setState({
        phase: 'error',
        error: 'no_data',
        message: 'Không tìm thấy thông tin nào. Kiểm tra lại nội dung dán vào.',
      })
    }
  }

  function handleApply(data: Partial<Announcement>) {
    onFilled(data)
    setApplied(true)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleFetch()
  }

  return (
    <div className="rounded-lg border border-dashed border-primary/40 bg-primary/[0.02] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">Trích xuất tự động từ thông báo</span>
        <Badge variant="secondary" className="text-[10px]">Beta</Badge>
      </div>

      {/* URL input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              if (state.phase !== 'idle') setState({ phase: 'idle' })
              setApplied(false)
            }}
            onKeyDown={handleKeyDown}
            placeholder="https://dgts.moj.gov.vn/thong-bao-lua-chon-to-chuc-dau-gia/..."
            className="pl-8 text-sm"
            disabled={state.phase === 'loading'}
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={handleFetch}
          disabled={!url.trim() || state.phase === 'loading'}
          className="shrink-0"
        >
          {state.phase === 'loading' ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              Đang tải...
            </>
          ) : (
            'Trích xuất'
          )}
        </Button>
      </div>

      {/* Success state */}
      {state.phase === 'success' && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">
                Trích xuất được {state.fieldsFound} trường
              </span>
            </div>
            {applied ? (
              <span className="text-xs text-emerald-600 font-medium">✓ Đã điền vào form</span>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleApply(state.data)}
              >
                Điền vào form
              </Button>
            )}
          </div>

          {/* Preview of extracted fields */}
          <div className="grid gap-1">
            {(Object.entries(state.data) as [keyof Announcement, unknown][])
              .filter(([, v]) => v !== undefined && v !== '' && v !== null)
              .map(([key, value]) => (
                <div key={key} className="flex gap-2 text-xs">
                  <span className="text-emerald-700 font-medium shrink-0 w-36">
                    {FIELD_LABELS[key] ?? key}
                  </span>
                  <span className="text-emerald-900 truncate">
                    {formatFieldValue(key, value)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {state.phase === 'error' && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">{state.message}</p>
          </div>
        </div>
      )}

      {/* Paste fallback toggle */}
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
        onClick={() => setShowPaste(!showPaste)}
      >
        <ClipboardPaste className="h-3.5 w-3.5" />
        <span>Dán nội dung thông báo thủ công</span>
        {isPasteVisible ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
      </button>

      {/* Paste textarea */}
      {isPasteVisible && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Mở link thông báo trong trình duyệt → Chọn tất cả (Ctrl+A) → Sao chép → Dán vào đây:
          </p>
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            placeholder="Dán toàn bộ nội dung trang thông báo lựa chọn tổ chức đấu giá..."
            className="text-xs font-mono resize-none"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handlePasteParse}
            disabled={!pasteText.trim()}
            className="w-full gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Phân tích nội dung đã dán
          </Button>
        </div>
      )}
    </div>
  )
}
