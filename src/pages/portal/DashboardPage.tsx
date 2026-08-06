import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useCapacityProfile } from '@/hooks/useCapacityProfile'
import { useOrgCpd } from '@/hooks/useOrgCpd'
import { useApplicationsList } from '@/hooks/useApplicationsList'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  FileText,
  GraduationCap,
  Plus,
  TrendingUp,
  XCircle,
} from 'lucide-react'

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 60) return diffMin <= 1 ? 'vừa xong' : `${diffMin} phút trước`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} giờ trước`
  const diffD = Math.floor(diffH / 24)
  if (diffD === 1) return 'hôm qua'
  if (diffD < 30) return `${diffD} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { profile } = useCapacityProfile()
  const cpdYear = new Date().getFullYear()
  const { summary: cpdSummary } = useOrgCpd(cpdYear)
  const cpdPending = cpdSummary.short + cpdSummary.overdue
  const { applications } = useApplicationsList()
  const draftApps = applications.filter((a) => a.status === 'DRAFT')

  const scorePercent = Math.round((profile.totalCapacityScore / 76) * 100)

  // ── Action suggestions sorted by ROI ───────────────────────────────────────
  const actionSuggestions = [
    { title: 'Hoàn thiện lịch sử đấu giá', gain: 21 - profile.scoreIV1to4, href: '/portal/nang-luc/lich-su-dau-gia' },
    { title: 'Bổ sung Cơ sở vật chất', gain: 19 - profile.scoreII, href: '/portal/nang-luc/co-so-vat-chat' },
    { title: 'Cập nhật Đấu giá viên', gain: 13 - profile.scoreIV6to8, href: '/portal/nang-luc/dau-gia-vien' },
    { title: 'Bổ sung năm hoạt động', gain: 4 - profile.scoreIV5, href: '/portal/nang-luc/thong-tin-chung' },
    { title: 'Cập nhật Thuế', gain: 3 - profile.scoreIV9, href: '/portal/nang-luc/tai-chinh' },
  ].filter((s) => s.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 4)

  const totalPotentialGain = actionSuggestions.reduce((sum, s) => sum + s.gain, 0)

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Tổng quan</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          🏢 {profile.companyName ?? 'Cổng quản lý tổ chức đấu giá'}
        </p>
      </div>

      {/* Mục I critical banner */}
      {!profile.onMinistryList && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-destructive">
              Mục I — Tiêu chí BẮT BUỘC chưa đạt. Hồ sơ sẽ bị loại.
            </p>
            <p className="text-xs text-destructive/80 mt-0.5">
              Tổ chức chưa có tên trong Danh sách Bộ Tư pháp.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="text-xs shrink-0 gap-1"
            onClick={() => navigate('/portal/nang-luc/thong-tin-chung')}
          >
            Khai báo ngay <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Bồi dưỡng bắt buộc: rủi ro tuân thủ, đứng ngay sau Mục I */}
      {cpdPending > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 p-4">
          <GraduationCap className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-warning">
              {cpdPending} đấu giá viên chưa hoàn thành nghĩa vụ bồi dưỡng năm {cpdYear}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tối thiểu 8 giờ/năm theo Thông tư 19/2024/TT-BTP. Hạn nộp giấy tờ cho
              Sở Tư pháp là 15/12 hằng năm.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs shrink-0 gap-1"
            onClick={() => navigate('/portal/boi-duong')}
          >
            Mở sổ bồi dưỡng <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Hero grid: score card + draft applications */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Score card */}
        <Card className="sm:col-span-2 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Điểm năng lực hiện tại
              </p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-4xl font-bold text-primary">{profile.totalCapacityScore}</span>
                <span className="text-lg text-muted-foreground">/76</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Mục I, II, IV — Phụ lục I TT19/2024</p>
            </div>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-primary/20">
              <span className="text-sm font-bold text-primary">{scorePercent}%</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <ScoreRow label="Mục II — Cơ sở vật chất" score={profile.scoreII} max={19} href="/portal/nang-luc/co-so-vat-chat" />
            <ScoreRow label="Mục IV.1-4 — Lịch sử đấu giá" score={profile.scoreIV1to4} max={21} href="/portal/nang-luc/lich-su-dau-gia" />
            <ScoreRow label="Mục IV.5 — Thời gian HĐ" score={profile.scoreIV5} max={4} href="/portal/nang-luc/thong-tin-chung" />
            <ScoreRow label="Mục IV.6-8 — Đấu giá viên" score={profile.scoreIV6to8} max={13} href="/portal/nang-luc/dau-gia-vien" />
            <ScoreRow label="Mục IV.9 — Thuế" score={profile.scoreIV9} max={3} href="/portal/nang-luc/tai-chinh" />
          </div>

        </Card>

        {/* Draft applications */}
        <Card className="p-5 flex flex-col">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Hồ sơ đang soạn
          </p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-4xl font-bold text-foreground">{draftApps.length}</span>
            <span className="text-sm text-muted-foreground">hồ sơ</span>
          </div>
          <div className="flex-1 mt-3 space-y-2 min-h-0">
            {draftApps.slice(0, 3).map((a) => (
              <button
                key={a.id}
                className="flex w-full items-start gap-2 text-left hover:bg-muted/40 rounded-md px-1 py-0.5 -mx-1 transition-colors"
                onClick={() => navigate(`/portal/ho-so-du-tuyen/${a.id}`)}
              >
                <FileText className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">{a.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {a.totalScore}% hoàn thành · {relativeTime(a.updatedAt)}
                  </p>
                </div>
              </button>
            ))}
            {draftApps.length > 3 && (
              <button
                className="text-xs text-primary hover:underline text-left mt-1 px-1"
                onClick={() => navigate('/portal/ho-so-du-tuyen')}
              >
                Xem thêm {draftApps.length - 3} hồ sơ →
              </button>
            )}
          </div>
          <Button
            size="sm"
            className="mt-4 gap-1.5 text-xs w-full"
            onClick={() => navigate('/portal/ho-so-du-tuyen/new')}
          >
            <Plus className="h-3.5 w-3.5" />
            Tạo hồ sơ mới
          </Button>
        </Card>
      </div>


      {/* Score improvement suggestions */}
      {actionSuggestions.length > 0 && (
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Cải thiện điểm năng lực</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ưu tiên theo điểm tăng cao nhất · Phụ lục I TT19/2024
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-700 whitespace-nowrap">
              Tiềm năng +{totalPotentialGain}đ
            </span>
          </div>
          <div className="space-y-2">
            {actionSuggestions.map((s) => (
              <ActionCard key={s.href} title={s.title} gain={s.gain} href={s.href} />
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

function ScoreRow({
  label,
  score,
  max,
  href,
}: {
  label: string
  score: number
  max: number
  href: string
}) {
  const navigate = useNavigate()
  const pct = Math.min((score / max) * 100, 100)
  return (
    <button
      className="flex w-full items-center gap-3 group"
      onClick={() => navigate(href)}
    >
      <span className="text-xs text-muted-foreground w-40 text-left truncate group-hover:text-foreground transition-colors">
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium w-10 text-right text-muted-foreground">
        {score}/{max}
      </span>
    </button>
  )
}

function ActionCard({
  title,
  gain,
  href,
}: {
  title: string
  gain: number
  href: string
}) {
  const navigate = useNavigate()
  return (
    <button
      className="flex items-center gap-3.5 rounded-xl border border-border bg-muted/30 hover:border-primary/30 hover:bg-primary/5 p-3.5 text-left transition-all w-full group"
      onClick={() => navigate(href)}
    >
      <div className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200">
        <span className="text-base font-bold text-emerald-700 leading-none">+{gain}</span>
        <span className="text-[9px] text-emerald-600 mt-0.5 leading-none">điểm</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Điểm năng lực · TT19/2024</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
    </button>
  )
}
