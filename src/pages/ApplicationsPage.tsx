import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { listApplications } from '@/lib/applications/storage'
import { ApplicationStatus } from '@/types/application'
import { Plus, FileText, ChevronRight } from 'lucide-react'

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

export default function ApplicationsPage() {
  const navigate = useNavigate()
  const applications = listApplications()

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
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

        {/* List */}
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
        ) : (
          <div className="space-y-2">
            {applications.map((item) => (
              <Card
                key={item.id}
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/portal/ho-so-du-tuyen/${item.id}`)}
              >
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Cập nhật {new Date(item.updatedAt).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANTS[item.status as ApplicationStatus]}>
                  {STATUS_LABELS[item.status as ApplicationStatus] ?? item.status}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
