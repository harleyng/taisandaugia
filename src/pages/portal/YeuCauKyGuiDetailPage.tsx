import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Loader2, SearchX, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  useOrgConsignmentContractList, useOrgServiceRequests, useRespondServiceRequest,
} from '@/hooks/useOrgServiceRequests'
import { ConsignmentCanvas } from '@/components/portal/consignment/ConsignmentCanvas'
import { StateCard } from '@/components/portal/consignment/StateCard'
import { DeclineDialog } from '@/components/portal/consignment/DeclineDialog'
import { RequestHero } from '@/components/portal/consignment/detail/RequestHero'
import { RequestActionBar } from '@/components/portal/consignment/detail/RequestActionBar'
import { SentQuoteCard } from '@/components/portal/consignment/detail/SentQuoteCard'
import { OwnerRequestCard } from '@/components/portal/consignment/detail/OwnerRequestCard'
import { AssetCards } from '@/components/portal/consignment/detail/AssetCards'
import { HistoryCard } from '@/components/portal/consignment/detail/HistoryCard'
import { Note } from '@/components/portal/consignment/detail/DetailCard'
import { buildRequestHistory } from '@/components/portal/consignment/detail/requestHistory'
import { fmtDate } from '@/components/portal/consignment/detail/format'

/**
 * Chi tiết một yêu cầu ký gửi theo góc nhìn tổ chức (design "Yeu Cau Ky Gui - Cong
 * To Chuc v2"): banner + thanh việc tiếp theo, cột thông tin, lịch sử bên phải.
 *
 * Dữ liệu yêu cầu đến từ RPC `org_service_requests` — đã lược danh tính chủ tài
 * sản, số nhà, giấy tờ sở hữu. Những thứ đó (và mọi thao tác hợp đồng) nằm ở trang
 * hợp đồng /portal/hop-dong/ky-gui/:id; trang này chỉ còn lối vào.
 */
export default function YeuCauKyGuiDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { requests, isLoading, hasOrg } = useOrgServiceRequests()
  const respond = useRespondServiceRequest()
  const { mutate } = respond

  const request = useMemo(() => requests.find((r) => r.id === id) ?? null, [requests, id])
  // Chỉ dòng tóm tắt (mã, trạng thái, việc của tổ chức) — cùng cache với menu "Hợp đồng".
  const contractList = useOrgConsignmentContractList(!!request?.contract_id)
  const contract = useMemo(
    () => (request?.contract_id ? (contractList.data ?? []).find((c) => c.id === request.contract_id) ?? null : null),
    [contractList.data, request?.contract_id],
  )

  const [declining, setDeclining] = useState(false)

  // Đánh dấu đã xem ngay khi mở — chủ tài sản thấy tổ chức đã tiếp cận hồ sơ.
  const markedSeen = useRef<string | null>(null)
  useEffect(() => {
    if (request?.status !== 'sent' || markedSeen.current === request.id) return
    markedSeen.current = request.id
    mutate({ requestId: request.id, action: 'seen' })
  }, [request?.id, request?.status, mutate])

  const history = useMemo(() => (request ? buildRequestHistory(request, contract) : []), [request, contract])

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

  const submitDecline = (reason: string) =>
    mutate({ requestId: r.id, action: 'decline', declineReason: reason }, { onSuccess: () => setDeclining(false) })

  return (
    <ConsignmentCanvas>
      <RequestHero
        request={r}
        fullAddress={null}
        actionBar={
          <RequestActionBar
            request={r}
            contract={contract}
            onQuote={() => navigate(`/portal/yeu-cau-ky-gui/${r.id}/bao-gia`)}
            onDecline={() => setDeclining(true)}
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
          {r.quoted_at && <SentQuoteCard request={r} />}
          <OwnerRequestCard request={r} />
          <AssetCards request={r} hasContract={!!r.contract_id} />
        </div>
        <aside className="flex min-w-0 flex-col gap-6 min-[1100px]:sticky min-[1100px]:top-6">
          <HistoryCard events={history} />
        </aside>
      </div>

      <DeclineDialog
        title={r.title}
        open={declining}
        onOpenChange={setDeclining}
        onConfirm={submitDecline}
        isPending={respond.isPending}
      />
    </ConsignmentCanvas>
  )
}
