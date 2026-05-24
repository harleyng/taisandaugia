import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCapacityProfile } from '@/hooks/useCapacityProfile'
import { listApplications } from '@/lib/applications/storage'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Plus,
  TrendingUp,
} from 'lucide-react'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { profile } = useCapacityProfile()
  const applications = listApplications()
  const draftApps = applications.filter((a) => a.status === 'DRAFT')

  const scorePercent = Math.round((profile.totalCapacityScore / 76) * 100)

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-base font-bold text-foreground">Tổng quan</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Cổng quản lý tổ chức đấu giá</p>
      </div>

      {/* Score card */}
      <div className="grid gap-4 sm:grid-cols-3">
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

          {/* Score breakdown bar */}
          <div className="mt-4 space-y-2">
            <ScoreRow label="Mục II — Cơ sở vật chất" score={profile.scoreII} max={19} href="/portal/nang-luc/co-so-vat-chat" />
            <ScoreRow label="Mục IV.1-4 — Lịch sử đấu giá" score={profile.scoreIV1to4} max={21} href="/portal/nang-luc/lich-su-dau-gia" />
            <ScoreRow label="Mục IV.5 — Thời gian HĐ" score={profile.scoreIV5} max={5} href="/portal/nang-luc/thong-tin-chung" />
            <ScoreRow label="Mục IV.6-8 — Đấu giá viên" score={profile.scoreIV6to8} max={9} href="/portal/nang-luc/dau-gia-vien" />
            <ScoreRow label="Mục IV.9 — Thuế" score={profile.scoreIV9} max={3} href="/portal/nang-luc/tai-chinh" />
          </div>

          <Button
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5 text-xs"
            onClick={() => navigate('/portal/nang-luc/thong-tin-chung')}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Cải thiện điểm năng lực
          </Button>
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
          <div className="flex-1 mt-3 space-y-1.5 min-h-0">
            {draftApps.slice(0, 3).map((a) => (
              <button
                key={a.id}
                className="flex w-full items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => navigate(`/portal/ho-so-du-tuyen/${a.id}`)}
              >
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate">{a.title}</span>
              </button>
            ))}
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

      {/* Warnings */}
      {profile.warnings.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-medium text-amber-800">Cảnh báo cần xử lý</p>
          </div>
          <div className="space-y-2">
            {profile.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-amber-700">
                <span className="shrink-0 mt-0.5">•</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 gap-1.5 text-xs border-amber-300"
            onClick={() => navigate('/portal/nang-luc/lich-su-dau-gia')}
          >
            Xem lịch sử đấu giá <ArrowRight className="h-3 w-3" />
          </Button>
        </Card>
      )}

      {/* Action suggestions */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Gợi ý hành động
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <ActionCard
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
            title="Cập nhật thông tin đấu giá viên"
            description="Mục IV.6-8 ảnh hưởng đến 9 điểm năng lực"
            href="/portal/nang-luc/dau-gia-vien"
          />
          <ActionCard
            icon={<FileText className="h-4 w-4 text-primary" />}
            title="Tạo hồ sơ dự tuyển mới"
            description="Soạn và xuất hồ sơ theo TT19/2024"
            href="/portal/ho-so-du-tuyen/new"
          />
        </div>
      </div>
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
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
}) {
  const navigate = useNavigate()
  return (
    <button
      className="flex items-start gap-3 rounded-lg border border-border bg-white p-3.5 text-left hover:bg-muted/30 transition-colors w-full"
      onClick={() => navigate(href)}
    >
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto mt-0.5 shrink-0" />
    </button>
  )
}
