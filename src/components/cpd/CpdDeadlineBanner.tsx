import { AlertTriangle, CalendarClock, CheckCircle2 } from 'lucide-react'
import { daysUntilFilingDeadline, type CpdSummary } from '@/lib/personnel/cpd'

interface Props {
  summary: CpdSummary
  year: number
}

/**
 * Mốc 15/12 là hạn nộp giấy tờ cho Sở Tư pháp (Điều 26.3), 31/12 là hạn Sở đăng
 * danh sách hoàn thành nghĩa vụ (Điều 27.2). Dự án chưa có cron/email nên đây là
 * kênh nhắc duy nhất — cùng lối với cảnh báo hết hạn thẻ ĐGV.
 */
export function CpdDeadlineBanner({ summary, year }: Props) {
  const pending = summary.short + summary.overdue
  const isCurrentYear = year === new Date().getFullYear()

  if (summary.total === 0) return null

  if (pending === 0) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-success/40 bg-success/5 p-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success mt-0.5" />
        <p className="text-sm">
          Cả {summary.total} đấu giá viên đã hoàn thành nghĩa vụ bồi dưỡng năm {year}.
        </p>
      </div>
    )
  }

  if (!isCurrentYear) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
        <div>
          <p className="text-sm font-medium text-destructive">
            {pending} đấu giá viên chưa hoàn thành nghĩa vụ bồi dưỡng năm {year}
          </p>
          <p className="text-xs text-destructive/80 mt-0.5">
            Năm {year} đã kết thúc. Bổ sung hồ sơ tại đây để lưu vết, nhưng nghĩa vụ
            của năm đó không còn khắc phục được.
          </p>
        </div>
      </div>
    )
  }

  const days = daysUntilFilingDeadline(year)
  const overdueFiling = days < 0
  // Tailwind quét class tĩnh — không nội suy được tên màu vào chuỗi class.
  const urgent = overdueFiling || days <= 30

  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border p-3 ${
        urgent ? 'border-destructive/40 bg-destructive/5' : 'border-warning/40 bg-warning/5'
      }`}
    >
      <CalendarClock
        className={`h-4 w-4 shrink-0 mt-0.5 ${urgent ? 'text-destructive' : 'text-warning'}`}
      />
      <div>
        <p className={`text-sm font-medium ${urgent ? 'text-destructive' : 'text-warning'}`}>
          {pending} đấu giá viên chưa đủ 8 giờ bồi dưỡng năm {year}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {overdueFiling
            ? `Đã quá hạn nộp giấy tờ cho Sở Tư pháp (15/12) ${Math.abs(days)} ngày. Sở đăng danh sách hoàn thành nghĩa vụ chậm nhất 31/12.`
            : `Còn ${days} ngày tới hạn nộp giấy tờ cho Sở Tư pháp (15/12/${year}).`}
        </p>
      </div>
    </div>
  )
}
