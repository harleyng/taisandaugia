import { Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { mucIV5NextThreshold } from '@/lib/general-info/scoring'
import type { OrgGeneralInfo } from '@/types/general-info'

interface Props {
  info: OrgGeneralInfo
  yearsOfOperation: { years: number; displayText: string } | null
  mucIV5Score: number
  onEdit: (section: 'profile' | 'docs') => void
}

interface Suggestion {
  key: string
  title: string
  description: string
  pointsGain: number | null
  section: 'profile' | 'docs'
}

function buildSuggestions(
  info: OrgGeneralInfo,
  yearsOfOperation: { years: number; displayText: string } | null,
  mucIV5Score: number,
): Suggestion[] {
  const items: Suggestion[] = []

  if (info.foundedDate && mucIV5Score < 4 && yearsOfOperation && yearsOfOperation.years > 0) {
    const next = mucIV5NextThreshold(yearsOfOperation.years)
    if (next) {
      items.push({
        key: 'years',
        title: `Thời gian hoạt động: ${yearsOfOperation.displayText}`,
        description: `Mục IV.5: ${mucIV5Score}/4 điểm — ${next}`,
        pointsGain: 4 - mucIV5Score,
        section: 'docs',
      })
    }
  }

  const missingFields: string[] = []
  if (!info.legalRepName) missingFields.push('Đại diện pháp lý')
  if (!info.phone) missingFields.push('Số điện thoại')
  if (!info.address) missingFields.push('Địa chỉ')
  if (missingFields.length > 0) {
    items.push({
      key: 'fields',
      title: 'Hoàn thiện thông tin cơ bản',
      description: `Còn thiếu: ${missingFields.join(', ')}`,
      pointsGain: null,
      section: 'profile',
    })
  }

  const missingDocs: string[] = []
  if (!info.foundedDate) missingDocs.push('Ngày thành lập')
  if (!info.establishmentDecisionFile) missingDocs.push('Quyết định thành lập')
  if (!info.businessLicenseFile) missingDocs.push('Giấy đăng ký hoạt động')
  if (missingDocs.length > 0) {
    items.push({
      key: 'docs',
      title: 'Hoàn thiện giấy tờ pháp lý',
      description: `Còn thiếu: ${missingDocs.join(', ')}`,
      pointsGain: null,
      section: 'docs',
    })
  }

  return items
}

export function GeneralInfoSuggestionsCard({ info, yearsOfOperation, mucIV5Score, onEdit }: Props) {
  const suggestions = buildSuggestions(info, yearsOfOperation, mucIV5Score)

  return (
    <div className="rounded-2xl border bg-amber-50 border-amber-200 p-4 space-y-3">
      {suggestions.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm font-medium text-amber-900">
              {suggestions.length} gợi ý hoàn thiện hồ sơ năng lực
            </p>
          </div>

          <div className="space-y-2">
            {suggestions.map((s) => (
              <div
                key={s.key}
                role="button"
                tabIndex={0}
                className="flex items-center justify-between rounded-xl bg-white border border-amber-100 px-3 py-2.5 cursor-pointer hover:bg-amber-50 transition-colors"
                onClick={() => onEdit(s.section)}
                onKeyDown={(e) => e.key === 'Enter' && onEdit(s.section)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{s.title}</p>
                    {s.pointsGain !== null && s.pointsGain > 0 && (
                      <span className="text-xs font-semibold text-green-700">+{s.pointsGain}đ</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 ml-3 h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={(e) => { e.stopPropagation(); onEdit(s.section) }}
                >
                  Sửa
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
