import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { FileDown, Loader2, ShieldAlert, Users } from 'lucide-react'
import { useOrgCpd } from '@/hooks/useOrgCpd'
import { selectableYears } from '@/lib/personnel/cpd'
import { cpdRowsToCsv, downloadCpdCsv } from '@/lib/personnel/cpd-export'
import { CpdStatsCards } from '@/components/cpd/CpdStatsCards'
import { CpdDeadlineBanner } from '@/components/cpd/CpdDeadlineBanner'
import { CpdComplianceTable } from '@/components/cpd/CpdComplianceTable'
import { CpdExemptionDialog } from '@/components/cpd/CpdExemptionDialog'
import { DossierEventDialog } from '@/components/personnel/DossierEventDialog'
import type { DossierEvent } from '@/types/personnel'

export default function BoiDuongPage() {
  const navigate = useNavigate()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const years = useMemo(() => selectableYears(), [])

  const {
    rows, summary, roster, applicable, exemptionByPerson, isLoading, hasOrg, organizationId,
    saveRecord, removeRecord, saveExemption, removeExemption,
  } = useOrgCpd(year)

  const [recordFor, setRecordFor] = useState<string | null>(null)
  const [editingRecord, setEditingRecord] = useState<DossierEvent | undefined>()
  const [exemptionFor, setExemptionFor] = useState<string | null>(null)

  const nameOf = (id: string) => roster.find((a) => a.id === id)?.fullName ?? ''

  const openAddRecord = (auctioneerId: string) => {
    setEditingRecord(undefined)
    setRecordFor(auctioneerId)
  }
  const openEditRecord = (auctioneerId: string, e: DossierEvent) => {
    setEditingRecord(e)
    setRecordFor(auctioneerId)
  }

  if (isLoading) {
    return (
      <div className="px-6 py-6">
        <Card className="p-10 flex items-center justify-center gap-2 text-sm text-muted-foreground rounded-2xl">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải sổ bồi dưỡng…
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
              Hoàn tất xác thực tổ chức đấu giá để theo dõi nghĩa vụ bồi dưỡng của đội ngũ.
            </p>
          </div>
          <Button size="sm" onClick={() => navigate('/dang-ky-to-chuc')}>Xác thực tổ chức</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="px-6 py-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Bồi dưỡng chuyên môn</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Nghĩa vụ bồi dưỡng chuyên môn, nghiệp vụ hằng năm của đấu giá viên —
            tối thiểu 8 giờ/năm theo Thông tư 19/2024/TT-BTP.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>Năm {y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={rows.length === 0}
            onClick={() => downloadCpdCsv(cpdRowsToCsv(rows, roster), year)}
          >
            <FileDown className="h-4 w-4" />
            Xuất CSV
          </Button>
        </div>
      </div>

      {applicable.length === 0 && (
        <Card className="p-10 text-center space-y-3 rounded-2xl">
          <Users className="h-9 w-9 text-muted-foreground mx-auto" />
          <div>
            <p className="text-sm font-medium">Chưa có đấu giá viên đang hành nghề</p>
            <p className="text-xs text-muted-foreground mt-1">
              Nghĩa vụ bồi dưỡng chỉ áp cho đấu giá viên đang hành nghề tại tổ chức.
              Khai báo đội ngũ ở mục Đấu giá viên trước.
            </p>
          </div>
          <Button size="sm" onClick={() => navigate('/portal/nang-luc/dau-gia-vien')}>
            Sang mục Đấu giá viên
          </Button>
        </Card>
      )}

      {applicable.length > 0 && (
        <>
          <CpdDeadlineBanner summary={summary} year={year} />
          <CpdStatsCards summary={summary} year={year} />
          <CpdComplianceTable
            rows={rows}
            roster={roster}
            exemptionByPerson={exemptionByPerson}
            onAddRecord={openAddRecord}
            onEditRecord={openEditRecord}
            onDeleteRecord={(auctioneerId, e) => removeRecord.mutate({ id: e.id, auctioneerId })}
            onEditExemption={setExemptionFor}
            onRemoveExemption={(x) => removeExemption.mutate(x)}
          />
        </>
      )}

      {recordFor && (
        <DossierEventDialog
          open={!!recordFor}
          onOpenChange={(o) => { if (!o) { setRecordFor(null); setEditingRecord(undefined) } }}
          eventType="TRAINING"
          existing={editingRecord}
          organizationId={organizationId ?? undefined}
          auctioneerId={recordFor}
          onSave={(ev) => saveRecord.mutate({ ...ev, auctioneerId: recordFor })}
        />
      )}

      {exemptionFor && (
        <CpdExemptionDialog
          open={!!exemptionFor}
          onOpenChange={(o) => { if (!o) setExemptionFor(null) }}
          year={year}
          personName={nameOf(exemptionFor)}
          existing={exemptionByPerson.get(exemptionFor)}
          organizationId={organizationId ?? undefined}
          auctioneerId={exemptionFor}
          onSave={(v) => saveExemption.mutate({ ...v, auctioneerId: exemptionFor, year })}
        />
      )}
    </div>
  )
}
