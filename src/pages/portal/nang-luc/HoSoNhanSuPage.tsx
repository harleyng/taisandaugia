import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileDown, FileText, Loader2, ShieldAlert, Download, Trash2, AlertTriangle, Eye,
} from 'lucide-react'
import { useAuctioneers } from '@/hooks/useAuctioneers'
import { useDossierExports } from '@/hooks/useDossierExports'
import { TEMPLATE_LABELS } from '@/lib/personnel/dossier-content'
import { DossierExportWizard } from '@/components/personnel/DossierExportWizard'
import { DossierPreviewDialog } from '@/components/personnel/DossierPreviewDialog'
import type { DossierExport } from '@/lib/personnel/exports-repo'

const fmtDateTime = (s: string) => new Date(s).toLocaleString('vi-VN')
const fmtSize = (b?: number | null) =>
  !b ? '' : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`

export default function HoSoNhanSuPage() {
  const navigate = useNavigate()
  const { auctioneers, isLoading: rosterLoading, hasOrg } = useAuctioneers()
  const {
    exports, isLoading, unitCost, balance, generate, remove, download, previewUrl,
  } = useDossierExports()

  const [wizardOpen, setWizardOpen] = useState(false)
  const [previewing, setPreviewing] = useState<DossierExport | null>(null)

  if (rosterLoading || isLoading) {
    return (
      <div className="px-6 py-6">
        <Card className="p-10 flex items-center justify-center gap-2 text-sm text-muted-foreground rounded-2xl">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải…
        </Card>
      </div>
    )
  }

  if (!hasOrg) {
    return (
      <div className="px-6 py-6">
        <Card className="p-10 text-center space-y-3 rounded-2xl">
          <ShieldAlert className="h-9 w-9 text-muted-foreground mx-auto" />
          <div>
            <p className="text-sm font-medium">Chưa có hồ sơ tổ chức</p>
            <p className="text-xs text-muted-foreground mt-1">
              Hoàn tất xác thực tổ chức đấu giá để bắt đầu xuất hồ sơ nhân sự.
            </p>
          </div>
          <Button size="sm" onClick={() => navigate('/dang-ky-to-chuc')}>Xác thực tổ chức</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="px-6 py-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Hồ sơ nhân sự</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Kết xuất hồ sơ đấu giá viên theo mẫu. Dữ liệu lấy từ Hồ sơ năng lực —
            mục Đấu giá viên và Lịch sử đấu giá.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5 shrink-0"
          disabled={auctioneers.length === 0}
          onClick={() => setWizardOpen(true)}
        >
          <FileDown className="h-4 w-4" />
          Xuất hồ sơ
        </Button>
      </div>

      {auctioneers.length === 0 && (
        <Card className="p-10 text-center space-y-3 rounded-2xl">
          <AlertTriangle className="h-9 w-9 text-muted-foreground mx-auto" />
          <div>
            <p className="text-sm font-medium">Chưa có đấu giá viên để xuất hồ sơ</p>
            <p className="text-xs text-muted-foreground mt-1">
              Khai báo đội ngũ ở mục Đấu giá viên trước, rồi quay lại đây để kết xuất.
            </p>
          </div>
          <Button size="sm" onClick={() => navigate('/portal/nang-luc/dau-gia-vien')}>
            Sang mục Đấu giá viên
          </Button>
        </Card>
      )}

      {auctioneers.length > 0 && exports.length === 0 && (
        <Card className="p-10 text-center space-y-3 rounded-2xl">
          <FileText className="h-9 w-9 text-muted-foreground mx-auto" />
          <div>
            <p className="text-sm font-medium">Chưa xuất hồ sơ nào</p>
            <p className="text-xs text-muted-foreground mt-1">
              Bấm “Xuất hồ sơ”, chọn người và mẫu — hồ sơ tạo ra sẽ nằm ở đây.
            </p>
          </div>
        </Card>
      )}

      {exports.length > 0 && (
        <Card className="rounded-2xl overflow-hidden">
          <div className="divide-y">
            {exports.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{e.auctioneerName}</span>
                    <Badge variant="secondary" className="text-xs font-normal">
                      {TEMPLATE_LABELS[e.template]}
                    </Badge>
                    <Badge variant="outline" className="text-xs font-normal">{e.format}</Badge>
                    {!e.filePath && (
                      <Badge variant="outline" className="text-xs font-normal text-destructive">
                        Không lưu được file
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[
                      e.licenseNumber ? `Thẻ ${e.licenseNumber}` : '',
                      fmtDateTime(e.generatedAt),
                      `${e.creditsCharged} credit`,
                      fmtSize(e.fileSizeBytes),
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  disabled={!e.filePath}
                  onClick={() => setPreviewing(e)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Xem
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  disabled={!e.filePath}
                  onClick={() => download(e)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Tải
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => remove.mutate(e)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <DossierPreviewDialog
        item={previewing}
        onOpenChange={(o) => { if (!o) setPreviewing(null) }}
        getUrl={previewUrl}
        onDownload={download}
      />

      <DossierExportWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        people={auctioneers}
        unitCost={unitCost}
        balance={balance}
        busy={generate.isPending}
        onGenerate={(input) =>
          generate.mutate(input, {
            onSuccess: (r) => { if (r.ok) setWizardOpen(false) },
          })
        }
      />
    </div>
  )
}
