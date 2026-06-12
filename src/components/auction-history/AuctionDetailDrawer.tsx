import { Drawer } from 'vaul'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ExternalLink, Pencil, X } from 'lucide-react'
import { format } from 'date-fns'
import { SourceBadge } from './SourceBadge'
import type { AuctionRecordWithComputed } from '@/types/auction-record'
import { ASSET_CATEGORY_LABELS, AUCTION_FORMAT_LABELS, BIDDING_METHOD_LABELS } from '@/types/auction-record'
import { AuctionAssetCard, type AuctionAsset } from '@/components/auction/AuctionAssetCard'
import { AuctionScheduleInfo } from '@/components/auction/AuctionScheduleInfo'
import { AuctionAttachments } from '@/components/auction/AuctionAttachments'
import { AuctionAssetOwnerCard } from '@/components/auction/AuctionAssetOwnerCard'

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
  rawListing?: Record<string, unknown> | null
  onEdit: (record: AuctionRecordWithComputed) => void
}

export function AuctionDetailDrawer({ open, onClose, record, rawListing, onEdit }: Props) {
  if (!record) return null

  const pct = record.priceDifferencePercentage
  const diff = record.priceDifference

  const ca = (rawListing?.custom_attributes ?? {}) as Record<string, unknown>

  const sharedLegalStatus = (rawListing?.legal_status ?? ca.legal_status ?? record.legalStatus) as string | undefined

  const assets: AuctionAsset[] = Array.isArray(ca.assets) && (ca.assets as unknown[]).length > 0
    ? (ca.assets as AuctionAsset[]).map((a) => ({ ...a, legal_status: a.legal_status ?? sharedLegalStatus }))
    : [{
        title: record.assetDescription,
        description: rawListing?.description as string | undefined,
        category: ASSET_CATEGORY_LABELS[record.assetCategory],
        quantity: ca.quantity as number | undefined,
        area: (rawListing?.area ?? ca.area) as number | undefined,
        location: record.assetLocation,
        legal_status: sharedLegalStatus,
        notes: ca.notes as string | undefined,
        starting_price: record.startingPrice,
        deposit_amount: ca.deposit_amount as number | undefined,
        document_fee: ca.document_fee as number | undefined,
        bid_step: record.bidStep,
        winning_price: record.winningPrice ?? null,
        auction_format: record.auctionFormat ? AUCTION_FORMAT_LABELS[record.auctionFormat] : ca.auction_format as string | undefined,
        bidding_method: record.biddingMethod ? BIDDING_METHOD_LABELS[record.biddingMethod] : ca.bidding_method as string | undefined,
      }]

  const ownerId = rawListing?.asset_owner_id as string | undefined

  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()} direction="right">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-background z-50 flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <SourceBadge source={record.badgeSource} />
              {record.isSuccessful === false && (
                <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">Không thành</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onEdit(record)}>
                <Pencil className="h-3.5 w-3.5" />Bổ sung thông tin
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Title */}
          <div className="px-5 pt-4 pb-2 shrink-0">
            <p className="text-xs text-muted-foreground">{format(new Date(record.auctionDate), 'dd/MM/yyyy')}</p>
            <h2 className="text-sm font-semibold mt-0.5 leading-snug">{record.assetDescription}</h2>
            <p className="text-xs text-muted-foreground mt-1">{ASSET_CATEGORY_LABELS[record.assetCategory]}</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            <Tabs defaultValue="overview" className="px-5 pt-2">
              <TabsList className="mb-4">
                <TabsTrigger value="overview" className="text-xs">Tổng quan</TabsTrigger>
                <TabsTrigger value="result" className="text-xs">Kết quả</TabsTrigger>
                <TabsTrigger value="scoring" className="text-xs">Điểm số</TabsTrigger>
              </TabsList>

              {/* Tab 1: Tổng quan — listing data */}
              <TabsContent value="overview" className="space-y-4 mt-0 pb-6">
                {/* Asset list — no winning price here */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Danh sách tài sản</p>
                  {assets.map((asset, i) => (
                    <AuctionAssetCard
                      key={i}
                      asset={asset}
                      index={i}
                      defaultOpen={assets.length === 1 || i === 0}
                      isUnlocked={true}
                      isLoggedIn={true}
                      showResult={false}
                    />
                  ))}
                </div>

                {/* Asset owner */}
                {ownerId && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chủ tài sản</p>
                    <AuctionAssetOwnerCard
                      ownerId={ownerId}
                      fromListing={rawListing ? { id: rawListing.id as string, title: record.assetDescription } : undefined}
                    />
                  </div>
                )}

                {/* Schedule */}
                {rawListing && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lịch trình đấu giá</p>
                    <AuctionScheduleInfo listing={rawListing} />
                  </div>
                )}

                {/* Attachments */}
                {rawListing && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">File đính kèm</p>
                    <AuctionAttachments listing={rawListing} />
                  </div>
                )}
              </TabsContent>

              {/* Tab 2: Kết quả — enrichment data */}
              <TabsContent value="result" className="space-y-4 mt-0 pb-6">
                {/* Per-asset price results */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kết quả theo tài sản</p>
                  {assets.map((asset, i) => {
                    const enrichedResult = record.assetResults?.[i]
                    const assetWinPrice = enrichedResult?.winning_price
                      ?? asset.winning_price
                      ?? (assets.length === 1 ? record.winningPrice : undefined)
                    const assetStatus = enrichedResult?.isSuccessful
                      ?? (assets.length === 1 ? record.isSuccessful : undefined)
                    const assetFailureReason = enrichedResult?.failureReason
                      ?? (assets.length === 1 ? record.failureReason : undefined)
                    return (
                      <div key={i} className="rounded-lg border border-border p-3 space-y-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-semibold text-muted-foreground shrink-0">#{i + 1}</span>
                          <p className="text-sm font-medium truncate">{asset.title || `Tài sản ${i + 1}`}</p>
                        </div>
                        <Row label="Giá khởi điểm" value={asset.starting_price ? fmtVND(asset.starting_price) : undefined} />
                        <Row label="Giá trúng" value={assetWinPrice ? fmtVND(assetWinPrice) : undefined} />
                        <Row label="Trạng thái" value={assetStatus === true ? 'Thành công' : assetStatus === false ? 'Không thành' : undefined} />
                        {assetFailureReason && <Row label="Lý do không thành" value={assetFailureReason} />}
                      </div>
                    )
                  })}
                </div>
                <Separator />
                {/* Session-level fields */}
                <div className="space-y-1">
                  <Row label="Hình thức đấu giá" value={record.auctionFormat ? AUCTION_FORMAT_LABELS[record.auctionFormat] : undefined} />
                  <Row label="Phương thức đấu giá" value={record.biddingMethod ? BIDDING_METHOD_LABELS[record.biddingMethod] : undefined} />
                  <Row label="Bước giá" value={record.bidStep ? fmtVND(record.bidStep) : undefined} />
                  <Row label="Số vòng tối đa" value={record.maxRounds} />
                  <Row label="Số vòng thực tế" value={record.actualRounds} />
                  <Row label="Số người tham gia" value={record.numberOfParticipants} />
                  <Row label="Tiền đặt trước" value={record.depositPercentage ? `${record.depositPercentage}%` : undefined} />
                  <Row label="Số HĐ dịch vụ" value={record.contractNumber} />
                  <Row label="Đấu giá viên phụ trách" value={record.auctioneer} />
                </div>
                {record.internalNotes && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Ghi chú nội bộ</p>
                      <p className="text-sm">{record.internalNotes}</p>
                    </div>
                  </>
                )}
                {record.crawledFromUrl && (
                  <div className="pt-1">
                    <a
                      href={record.crawledFromUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Xem trên Cổng QG
                    </a>
                  </div>
                )}
              </TabsContent>

              {/* Tab 3: Điểm số */}
              <TabsContent value="scoring" className="space-y-4 mt-0 pb-6">
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
                  <div className="rounded-lg border border-dashed border-border p-4 space-y-1 text-center">
                    <p className="text-sm font-medium text-muted-foreground">TBC</p>
                    <p className="text-xs text-muted-foreground">Chênh lệch tổng được xác nhận sau khi có giá trúng từng tài sản</p>
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

                {record.overrides.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lịch sử thay đổi</p>
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
