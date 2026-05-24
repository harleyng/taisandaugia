import { Drawer } from 'vaul'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Pencil, X } from 'lucide-react'
import { format } from 'date-fns'
import { SourceBadge } from './SourceBadge'
import type { AuctionRecordWithComputed } from '@/types/auction-record'
import { ASSET_CATEGORY_LABELS, AUCTION_FORMAT_LABELS } from '@/types/auction-record'

function fmtVND(n: number): string {
  return n.toLocaleString('vi-VN') + ' VND'
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-border/50 last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{typeof value === 'number' ? value.toLocaleString('vi-VN') : value}</span>
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  record: AuctionRecordWithComputed | null
  onEdit: (record: AuctionRecordWithComputed) => void
}

export function AuctionDetailDrawer({ open, onClose, record, onEdit }: Props) {
  if (!record) return null

  const pct = record.priceDifferencePercentage
  const diff = record.priceDifference

  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()} direction="right">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background z-50 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <SourceBadge source={record.badgeSource} />
              {record.isSuccessful === false && (
                <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">Không thành</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onEdit(record)}>
                <Pencil className="h-3.5 w-3.5" />Sửa
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-5 pt-4 pb-2">
              <p className="text-xs text-muted-foreground">{format(new Date(record.auctionDate), 'dd/MM/yyyy')}</p>
              <h2 className="text-sm font-semibold mt-0.5 leading-snug">{record.assetDescription}</h2>
              <p className="text-xs text-muted-foreground mt-1">{ASSET_CATEGORY_LABELS[record.assetCategory]}</p>
            </div>

            <Tabs defaultValue="overview" className="px-5 pt-2">
              <TabsList className="mb-4">
                <TabsTrigger value="overview" className="text-xs">Tổng quan</TabsTrigger>
                <TabsTrigger value="scoring" className="text-xs">Chênh lệch & Điểm</TabsTrigger>
                <TabsTrigger value="overrides" className="text-xs">Lịch sử thay đổi</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-1 mt-0">
                <Row label="Ngày đấu giá" value={format(new Date(record.auctionDate), 'dd/MM/yyyy')} />
                <Row label="Số phiên" value={record.auctionNumber} />
                <Row label="Người có tài sản" value={record.ownerName} />
                <Row label="Địa chỉ" value={record.assetLocation} />
                <Row label="Số HĐ dịch vụ" value={record.contractNumber} />
                <Separator className="my-2" />
                <Row label="Giá khởi điểm" value={fmtVND(record.startingPrice)} />
                <Row label="Giá trúng" value={record.winningPrice ? fmtVND(record.winningPrice) : undefined} />
                <Row label="Trạng thái" value={record.isSuccessful === true ? 'Thành công' : record.isSuccessful === false ? 'Không thành' : undefined} />
                <Row label="Lý do không thành" value={record.failureReason} />
                <Separator className="my-2" />
                <Row label="Hình thức" value={record.auctionFormat ? AUCTION_FORMAT_LABELS[record.auctionFormat] : undefined} />
                <Row label="Bước giá" value={record.bidStep ? fmtVND(record.bidStep) : undefined} />
                <Row label="Số vòng tối đa" value={record.maxRounds} />
                <Row label="Số vòng thực tế" value={record.actualRounds} />
                <Row label="Số người tham gia" value={record.numberOfParticipants} />
                <Row label="Tiền đặt trước" value={record.depositPercentage ? `${record.depositPercentage}%` : undefined} />
                {record.internalNotes && (
                  <div className="py-2">
                    <p className="text-xs text-muted-foreground mb-1">Ghi chú nội bộ</p>
                    <p className="text-sm">{record.internalNotes}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="scoring" className="space-y-4 mt-0">
                {diff !== undefined && pct !== undefined ? (
                  <div className="rounded-lg border border-border p-4 space-y-3">
                    <h3 className="text-sm font-semibold">Chênh lệch giá</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 rounded-lg bg-muted/40">
                        <p className="text-xs text-muted-foreground">Chênh lệch tuyệt đối</p>
                        <p className="text-lg font-bold text-foreground mt-1">{(diff / 1_000_000).toFixed(0)} tr</p>
                        <p className="text-xs text-muted-foreground">VND</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-muted/40">
                        <p className="text-xs text-muted-foreground">Chênh lệch %</p>
                        <p className={`text-lg font-bold mt-1 ${pct >= 10 ? 'text-success' : 'text-foreground'}`}>
                          +{pct.toFixed(1)}%
                        </p>
                        {pct >= 10 && <p className="text-xs text-success">Đủ điều kiện IV.4</p>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Chưa có giá trúng — không thể tính chênh lệch
                  </div>
                )}

                <div className="rounded-lg border border-border p-4 space-y-2">
                  <h3 className="text-sm font-semibold">Đóng góp vào điểm số</h3>
                  {[
                    { label: 'IV.1 (Tổng cuộc)', contributes: true },
                    { label: 'IV.2 (Cuộc thành)', contributes: record.isSuccessful === true },
                    { label: 'IV.3 (Có chênh lệch)', contributes: record.isSuccessful === true && diff !== undefined && diff > 0 },
                    { label: 'IV.4 (Chênh ≥10%)', contributes: record.isAboveTenPercent === true },
                  ].map(({ label, contributes }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={contributes ? 'text-success font-medium' : 'text-muted-foreground'}>
                        {contributes ? '✓ Tính điểm' : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="overrides" className="mt-0">
                {record.overrides.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Chưa có thay đổi nào được ghi nhận</p>
                ) : (
                  <div className="space-y-3">
                    {record.overrides.map((o, i) => (
                      <div key={i} className="rounded-lg border border-border p-3 text-sm space-y-1">
                        <p className="font-medium">{o.field}</p>
                        <p className="text-muted-foreground text-xs">
                          <span className="line-through">{o.originalValue}</span>
                          {' → '}
                          <span className="text-foreground">{o.overriddenValue}</span>
                        </p>
                        {o.reason && <p className="text-xs text-muted-foreground">Lý do: {o.reason}</p>}
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(o.overriddenAt), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
