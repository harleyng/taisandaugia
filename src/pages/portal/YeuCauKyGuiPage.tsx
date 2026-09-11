import { useMemo, useState } from 'react'
import { Inbox, Loader2, MapPin, ShieldAlert } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ASSET_CATEGORIES } from '@/constants/category.constants'
import { formatVnd } from '@/lib/advertising/slug'
import {
  useOrgServiceRequestCounts, useOrgServiceRequests, useRespondServiceRequest,
} from '@/hooks/useOrgServiceRequests'
import { QuoteDialog } from '@/components/portal/consignment/quote/QuoteDialog'
import { DeclineDialog } from '@/components/portal/consignment/DeclineDialog'
import { RequestDetailSheet } from '@/components/portal/consignment/RequestDetailSheet'
import {
  ORG_REQUEST_STATUS_LABELS, REQUEST_STATUS_BADGE_CLASS,
  type OrgServiceRequest, type ServiceQuoteInput, type ServiceRequestStatus,
} from '@/types/consignment'
import { CONTRACT_STATUS_BADGE_CLASS, CONTRACT_STATUS_LABELS_ORG } from '@/types/consignment-contract'

const PARENT_NAME: Record<string, string> = Object.fromEntries(ASSET_CATEGORIES.map((p) => [p.slug, p.name]))

type TabKey = 'open' | 'quoted' | 'declined' | 'won'

const TABS: { key: TabKey; label: string; match: ServiceRequestStatus[] }[] = [
  { key: 'open', label: 'Cần trả lời', match: ['sent', 'seen'] },
  { key: 'quoted', label: 'Đã báo giá', match: ['quoted'] },
  { key: 'won', label: 'Đã trúng · hợp đồng', match: ['selected', 'accepted'] },
  { key: 'declined', label: 'Đã đóng', match: ['declined', 'not_selected', 'contract_cancelled'] },
]

function RequestCard({ r, onOpen }: { r: OrgServiceRequest; onOpen: () => void }) {
  const location = [r.district, r.province].filter(Boolean).join(', ')
  const reopened = !!r.reopened_at && (r.status === 'sent' || r.status === 'seen' || r.status === 'quoted')
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate font-semibold text-foreground">{r.title}</p>
          <p className="text-xs text-muted-foreground">
            {PARENT_NAME[r.parent_slug] ?? r.parent_slug}
            {location && (
              <>
                {' · '}
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {location}
                </span>
              </>
            )}
            {r.origin === 'platform' && ' · Sàn giới thiệu'}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${REQUEST_STATUS_BADGE_CLASS[r.status]}`}>
            {ORG_REQUEST_STATUS_LABELS[r.status]}
          </span>
          {r.contract_status && r.status !== 'contract_cancelled' && (
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${CONTRACT_STATUS_BADGE_CLASS[r.contract_status]}`}>
              {CONTRACT_STATUS_LABELS_ORG[r.contract_status]}
            </span>
          )}
          {reopened && (
            <span className="rounded-full bg-accent/20 px-2.5 py-1 text-[11px] font-medium text-foreground">Mở lại</span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          Giá khởi điểm:{' '}
          <b className="font-semibold text-foreground">
            {r.pricing_mode === 'appraisal'
              ? 'Nhờ định giá'
              : r.starting_price != null
                ? formatVnd(r.starting_price)
                : '—'}
          </b>
        </span>
        {r.commission_pct != null && <span>Thù lao chấp nhận: {r.commission_pct}%</span>}
        {r.quote_commission_pct != null && (
          <span>
            Bạn chào: <b className="font-semibold text-foreground">{r.quote_commission_pct}%</b>
          </span>
        )}
      </div>
    </button>
  )
}

/** Hộp thư yêu cầu ký gửi tài sản gửi tới tổ chức đấu giá. */
export default function YeuCauKyGuiPage() {
  const { requests, isLoading, hasOrg, organizationId, auctionOrgId } = useOrgServiceRequests()
  const respond = useRespondServiceRequest()
  const { contractsActionCount } = useOrgServiceRequestCounts()

  const [tab, setTab] = useState<TabKey>('open')
  const [openId, setOpenId] = useState<string | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [declining, setDeclining] = useState(false)

  const selected = useMemo(() => requests.find((r) => r.id === openId) ?? null, [requests, openId])

  const counts = useMemo(() => {
    const map = {} as Record<TabKey, number>
    for (const t of TABS) map[t.key] = requests.filter((r) => t.match.includes(r.status)).length
    return map
  }, [requests])

  const visible = useMemo(() => {
    const match = TABS.find((t) => t.key === tab)?.match ?? []
    return requests.filter((r) => match.includes(r.status))
  }, [requests, tab])

  const openRequest = (r: OrgServiceRequest) => {
    setOpenId(r.id)
    // Đánh dấu đã xem ngay khi mở — chủ tài sản thấy tổ chức đã tiếp cận hồ sơ.
    if (r.status === 'sent') respond.mutate({ requestId: r.id, action: 'seen' })
  }

  const submitQuote = (quote: ServiceQuoteInput) => {
    if (!selected) return
    respond.mutate(
      { requestId: selected.id, action: 'quote', quote },
      {
        onSuccess: () => {
          setQuoting(false)
          setOpenId(null)
        },
      },
    )
  }

  const submitDecline = (reason: string) => {
    if (!selected) return
    respond.mutate(
      { requestId: selected.id, action: 'decline', declineReason: reason },
      {
        onSuccess: () => {
          setDeclining(false)
          setOpenId(null)
        },
      },
    )
  }

  if (isLoading) {
    return (
      <div className="px-6 py-6">
        <Card className="flex items-center justify-center gap-2 rounded-2xl p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Đang tải yêu cầu ký gửi…
        </Card>
      </div>
    )
  }

  if (!hasOrg) {
    return (
      <div className="px-6 py-6">
        <Card className="space-y-3 rounded-2xl p-10 text-center">
          <ShieldAlert className="mx-auto h-9 w-9 text-muted-foreground" />
          <div>
            <p className="font-semibold text-foreground">Chưa liên kết tổ chức đấu giá</p>
            <p className="text-sm text-muted-foreground">
              Tài khoản của bạn chưa gắn với tổ chức nào trong danh bạ, nên chưa nhận được yêu cầu ký gửi.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5 px-6 py-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Yêu cầu ký gửi</h1>
        <p className="text-sm text-muted-foreground">
          Tài sản chủ sở hữu muốn đưa ra đấu giá. Duyệt và gửi báo giá; khi được chọn, soạn và ký hợp đồng dịch vụ
          ngay tại đây.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.key}
            variant={tab === t.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab(t.key)}
            className="gap-1.5"
          >
            {t.label}
            <span className={tab === t.key ? 'opacity-80' : 'text-muted-foreground'}>{counts[t.key]}</span>
            {t.key === 'won' && contractsActionCount > 0 && (
              <span
                className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-accent-foreground"
                aria-label={`${contractsActionCount} hợp đồng cần bạn xử lý`}
              >
                {contractsActionCount} cần xử lý
              </span>
            )}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Card className="space-y-2 rounded-2xl p-12 text-center">
          <Inbox className="mx-auto h-9 w-9 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {tab === 'open' ? 'Chưa có yêu cầu nào chờ bạn trả lời.' : 'Chưa có yêu cầu nào trong mục này.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <RequestCard key={r.id} r={r} onOpen={() => openRequest(r)} />
          ))}
        </div>
      )}

      <RequestDetailSheet
        request={selected}
        auctionOrgId={auctionOrgId}
        onOpenChange={(open) => !open && setOpenId(null)}
        onQuote={() => setQuoting(true)}
        onDecline={() => setDeclining(true)}
      />

      <QuoteDialog
        request={selected}
        organizationId={organizationId}
        open={quoting}
        onOpenChange={setQuoting}
        onSubmit={submitQuote}
        isPending={respond.isPending}
      />

      <DeclineDialog
        title={selected?.title}
        open={declining}
        onOpenChange={setDeclining}
        onConfirm={submitDecline}
        isPending={respond.isPending}
      />
    </div>
  )
}
