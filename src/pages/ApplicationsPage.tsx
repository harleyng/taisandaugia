import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { listApplications } from '@/lib/applications/storage'
import { ApplicationStatus } from '@/types/application'
import { Plus, FileText, ChevronRight, Search, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Nháp',
  EXPORTED: 'Đã xuất file',
  SUBMITTED: 'Đã nộp',
  WON: 'Trúng thầu',
  LOST: 'Không trúng',
}

const STATUS_VARIANTS: Record<ApplicationStatus, 'outline' | 'secondary' | 'default' | 'destructive'> = {
  DRAFT: 'outline',
  EXPORTED: 'secondary',
  SUBMITTED: 'default',
  WON: 'default',
  LOST: 'destructive',
}

function DeadlineChip({ deadline }: { deadline: string }) {
  if (!deadline) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(deadline)
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  const label = due.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

  if (diffDays < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium">
        <AlertCircle className="h-3 w-3" />
        Hết hạn {label}
      </span>
    )
  }
  if (diffDays <= 7) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
        <Clock className="h-3 w-3" />
        Còn {diffDays} ngày — {label}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      Hạn nộp {label}
    </span>
  )
}

function ScoreBadge({ score }: { score: number }) {
  if (!score && score !== 0) return null
  const color =
    score >= 70 ? 'text-green-700 bg-green-50 border-green-200' :
    score >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200' :
    'text-muted-foreground bg-muted border-border'

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums', color)}>
      {score}/100
    </span>
  )
}

export default function ApplicationsPage() {
  const navigate = useNavigate()
  const applications = listApplications()

  const [search, setSearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('__all__')

  const uniqueOwners = useMemo(() => {
    const names = applications.map((a) => a.ownerName).filter(Boolean)
    return Array.from(new Set(names)).sort()
  }, [applications])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return applications.filter((a) => {
      const matchSearch = !q || a.title.toLowerCase().includes(q)
      const matchOwner = ownerFilter === '__all__' || a.ownerName === ownerFilter
      return matchSearch && matchOwner
    })
  }, [applications, search, ownerFilter])

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-lg font-bold text-foreground">Hồ sơ dự tuyển đấu giá</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Lập hồ sơ theo Thông tư 19/2024/TT-BTP
            </p>
          </div>
          <Button onClick={() => navigate('/portal/ho-so-du-tuyen/new')} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            Tạo hồ sơ mới
          </Button>
        </div>

        {/* Search & filter */}
        {applications.length > 0 && (
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8 h-9 text-sm"
                placeholder="Tìm theo tên cuộc đấu giá..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="h-9 w-48 text-sm shrink-0">
                <SelectValue placeholder="Chủ tài sản" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tất cả chủ tài sản</SelectItem>
                {uniqueOwners.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Empty state */}
        {applications.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-base font-semibold text-foreground mb-1">Chưa có hồ sơ nào</h2>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
              Tạo hồ sơ đầu tiên để bắt đầu soạn hồ sơ dự tuyển đấu giá
            </p>
            <Button onClick={() => navigate('/portal/ho-so-du-tuyen/new')} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Tạo hồ sơ mới
            </Button>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center">
            <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Không tìm thấy hồ sơ phù hợp</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <Card
                key={item.id}
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/portal/ho-so-du-tuyen/${item.id}`)}
              >
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <DeadlineChip deadline={item.deadline} />
                    {!item.deadline && (
                      <span className="text-xs text-muted-foreground">
                        Cập nhật {new Date(item.updatedAt).toLocaleDateString('vi-VN')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <ScoreBadge score={item.totalScore} />
                  <Badge variant={STATUS_VARIANTS[item.status as ApplicationStatus]}>
                    {STATUS_LABELS[item.status as ApplicationStatus] ?? item.status}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
