import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2, SearchX, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOrgServiceRequests, useRespondServiceRequest } from '@/hooks/useOrgServiceRequests'
import { useOrgConsignmentContract } from '@/hooks/useConsignmentContract'
import { ConsignmentCanvas } from '@/components/portal/consignment/ConsignmentCanvas'
import { QuoteDialog } from '@/components/portal/consignment/quote/QuoteDialog'
import { DeclineDialog } from '@/components/portal/consignment/DeclineDialog'
import { RequestHero } from '@/components/portal/consignment/detail/RequestHero'
import { RequestActionBar, type ContractDialogKind } from '@/components/portal/consignment/detail/RequestActionBar'
import { ContractCard } from '@/components/portal/consignment/detail/ContractCard'
import { ContractDialogs } from '@/components/portal/consignment/detail/ContractDialogs'
import { SentQuoteCard } from '@/components/portal/consignment/detail/SentQuoteCard'
import { OwnerRequestCard } from '@/components/portal/consignment/detail/OwnerRequestCard'
import { AssetCards } from '@/components/portal/consignment/detail/AssetCards'
import { HistoryCard } from '@/components/portal/consignment/detail/HistoryCard'
import { Note } from '@/components/portal/consignment/detail/DetailCard'
import { buildRequestHistory } from '@/components/portal/consignment/detail/requestHistory'
import { fmtDate } from '@/components/portal/consignment/detail/format'
import type { ServiceQuoteInput } from '@/types/consignment'

function StateCard({ children }: { children: ReactNode }) {
  return (
    <ConsignmentCanvas>
      <div className="space-y-3 rounded-2xl bg-card p-10 text-center shadow-card">{children}</div>
    </ConsignmentCanvas>
  )
}

/**
 * Chi tiết một yêu cầu ký gửi theo góc nhìn tổ chức (design "Yeu Cau Ky Gui - Cong
 * To Chuc v2"): banner + thanh việc tiếp theo, cột thông tin, lịch sử bên phải.
 *
 * Dữ liệu yêu cầu đến từ RPC `org_service_requests` — đã lược danh tính chủ tài
 * sản, số nhà, giấy tờ sở hữu. Những thứ đó chỉ có trong thẻ hợp đồng (RPC
 * org_consignment_contract) sau khi tổ chức được chọn.
 */
export default function YeuCauKyGuiDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { requests, isLoading, hasOrg, organizationId, auctionOrgId } = useOrgServiceRequests()
  const respond = useRespondServiceRequest()
  const { mutate } = respond

  const request = useMemo(() => requests.find((r) => r.id === id) ?? null, [requests, id])
  const contractQ = useOrgConsignmentContract(request?.contract_id ? request.id : null)
  const contract = contractQ.data

  const [quoting, setQuoting] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [contractDialog, setContractDialog] = useState<ContractDialogKind | null>(null)

  // Đánh dấu đã xem ngay khi mở — chủ tài sản thấy tổ chức đã tiếp cận hồ sơ.
  const markedSeen = useRef<string | null>(null)
  useEffect(() => {
    if (request?.status !== 'sent' || markedSeen.current === request.id) return
    markedSeen.current = request.id
    mutate({ requestId: request.id, action: 'seen' })
  }, [request?.id, request?.status, mutate])

  const history = useMemo(() => (request ? buildRequestHistory(request, contract ?? null) : []), [request, contract])

  if (isLoading) {
    return (
      <StateCard>
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Đang tải yêu cầu ký gửi…
        </p>
      </StateCard>
    )
  }

  if (!hasOrg) {
    return (
      <StateCard>
        <ShieldAlert className="mx-auto h-9 w-9 text-muted-foreground" />
        <p className="font-semibold text-foreground">Chưa liên kết tổ chức đấu giá</p>
        <p className="text-sm text-muted-foreground">
          Tài khoản của bạn chưa gắn với tổ chức nào trong danh bạ, nên chưa nhận được yêu cầu ký gửi.
        </p>
      </StateCard>
    )
  }

  if (!request) {
    return (
      <StateCard>
        <SearchX className="mx-auto h-9 w-9 text-muted-foreground" />
        <p className="font-semibold text-foreground">Không tìm thấy yêu cầu</p>
        <p className="text-sm text-muted-foreground">Yêu cầu không tồn tại hoặc chủ tài sản đã thu hồi.</p>
        <Button variant="outline" onClick={() => navigate('/portal/yeu-cau-ky-gui')}>
          Về danh sách yêu cầu
        </Button>
      </StateCard>
    )
  }

  const r = request
  const fullAddress = contract?.asset
    ? [contract.asset.address, contract.asset.ward, contract.asset.district, contract.asset.province]
        .filter(Boolean)
        .join(', ')
    : null

  const submitQuote = (quote: ServiceQuoteInput) =>
    mutate({ requestId: r.id, action: 'quote', quote }, { onSuccess: () => setQuoting(false) })
  const submitDecline = (reason: string) =>
    mutate({ requestId: r.id, action: 'decline', declineReason: reason }, { onSuccess: () => setDeclining(false) })

  return (
    <ConsignmentCanvas>
      <RequestHero
        request={r}
        fullAddress={fullAddress}
        actionBar={
          <RequestActionBar
            request={r}
            contract={contract}
            onQuote={() => setQuoting(true)}
            onDecline={() => setDeclining(true)}
            onContract={setContractDialog}
          />
        }
      />

      {r.reopened_at && ['sent', 'seen', 'quoted'].includes(r.status) && (
        <Note tone="accent">
          Yêu cầu đã mở lại ngày {fmtDate(r.reopened_at)}: hợp đồng giữa chủ tài sản và tổ chức được chọn trước đó đã bị
          huỷ. Bạn có thể cập nhật báo giá.
        </Note>
      )}

      <div className="grid items-start gap-6 min-[1100px]:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {r.contract_id && (
            <ContractCard
              detail={contract}
              isLoading={contractQ.isLoading}
              failed={!!contractQ.error}
              startingPrice={r.starting_price}
            />
          )}
          {r.quoted_at && !r.contract_id && <SentQuoteCard request={r} />}
          <OwnerRequestCard request={r} />
          <AssetCards request={r} hasContract={!!r.contract_id} />
        </div>
        <aside className="flex min-w-0 flex-col gap-6 min-[1100px]:sticky min-[1100px]:top-6">
          <HistoryCard events={history} />
        </aside>
      </div>

      <QuoteDialog
        request={r}
        organizationId={organizationId}
        open={quoting}
        onOpenChange={setQuoting}
        onSubmit={submitQuote}
        isPending={respond.isPending}
      />
      <DeclineDialog
        title={r.title}
        open={declining}
        onOpenChange={setDeclining}
        onConfirm={submitDecline}
        isPending={respond.isPending}
      />
      {contract && (
        <ContractDialogs
          detail={contract}
          requestId={r.id}
          auctionOrgId={auctionOrgId}
          open={contractDialog}
          onClose={() => setContractDialog(null)}
        />
      )}
    </ConsignmentCanvas>
  )
}
