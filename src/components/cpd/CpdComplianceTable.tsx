import { Fragment, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ChevronDown, ChevronRight, Plus, ShieldOff } from 'lucide-react'
import type { CpdExemption, DossierEvent } from '@/types/personnel'
import type { Auctioneer } from '@/types/auctioneer'
import { POSITION_LABELS } from '@/types/auctioneer'
import { progressHours, type CpdPersonYear } from '@/lib/personnel/cpd'
import { CpdProofBadge, CpdStatusBadge } from './CpdStatusBadge'
import { CpdPersonRecords } from './CpdPersonRecords'

type Row = CpdPersonYear & { name: string }

interface Props {
  rows: Row[]
  roster: Auctioneer[]
  exemptionByPerson: Map<string, CpdExemption>
  onAddRecord: (auctioneerId: string) => void
  onEditRecord: (auctioneerId: string, e: DossierEvent) => void
  onDeleteRecord: (auctioneerId: string, e: DossierEvent) => void
  onEditExemption: (auctioneerId: string) => void
  onRemoveExemption: (x: CpdExemption) => void
}

export function CpdComplianceTable({
  rows, roster, exemptionByPerson,
  onAddRecord, onEditRecord, onDeleteRecord, onEditExemption, onRemoveExemption,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const byId = new Map(roster.map((a) => [a.id, a]))

  return (
    <Card className="rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="w-8" />
              <th className="text-left font-medium px-3 py-2.5">Đấu giá viên</th>
              <th className="text-left font-medium px-3 py-2.5 hidden md:table-cell">Chức vụ</th>
              <th className="text-left font-medium px-3 py-2.5 hidden lg:table-cell">Số thẻ ĐGV</th>
              <th className="text-left font-medium px-3 py-2.5 w-44">Giờ bồi dưỡng</th>
              <th className="text-left font-medium px-3 py-2.5">Trạng thái</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const person = byId.get(r.auctioneerId)
              const open = expanded === r.auctioneerId
              const shown = progressHours(r)
              const pct = Math.min(100, (shown / r.required) * 100)
              return (
                <Fragment key={r.auctioneerId}>
                  <tr className="hover:bg-muted/30">
                    <td className="px-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setExpanded(open ? null : r.auctioneerId)}
                        aria-label={open ? 'Thu gọn' : 'Xem chi tiết'}
                      >
                        {open
                          ? <ChevronDown className="h-4 w-4" />
                          : <ChevronRight className="h-4 w-4" />}
                      </Button>
                    </td>
                    <td className="px-3 py-2.5 font-medium">{r.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">
                      {person ? POSITION_LABELS[person.position] : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">
                      {person?.licenseNumber || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.isExempt ? (
                        <span className="text-xs text-muted-foreground">Không áp dụng</span>
                      ) : (
                        <div className="space-y-1">
                          <Progress value={pct} className="h-1.5" />
                          <span className="text-xs text-muted-foreground">
                            {shown}/{r.required} giờ
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <CpdStatusBadge ev={r} />
                        <CpdProofBadge ev={r} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Ghi nhận hoạt động"
                          onClick={() => onAddRecord(r.auctioneerId)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Đăng ký diện miễn"
                          onClick={() => onEditExemption(r.auctioneerId)}
                        >
                          <ShieldOff className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <CpdPersonRecords
                          records={r.records}
                          exemption={exemptionByPerson.get(r.auctioneerId)}
                          onEdit={(e) => onEditRecord(r.auctioneerId, e)}
                          onDelete={(e) => onDeleteRecord(r.auctioneerId, e)}
                          onEditExemption={() => onEditExemption(r.auctioneerId)}
                          onRemoveExemption={() => {
                            const x = exemptionByPerson.get(r.auctioneerId)
                            if (x) onRemoveExemption(x)
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
