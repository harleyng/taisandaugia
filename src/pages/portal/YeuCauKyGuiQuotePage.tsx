import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Ban, Loader2, SearchX, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOrgServiceRequests } from '@/hooks/useOrgServiceRequests'
import { StateCard } from '@/components/portal/consignment/StateCard'
import { QuoteEditor } from '@/components/portal/consignment/quote/QuoteEditor'
import { isOpen } from '@/components/portal/consignment/list/requestRows'

/**
 * Trang "Gửi báo giá" / "Cập nhật báo giá" cho một yêu cầu ký gửi (design "Yeu
 * Cau Ky Gui - Cong To Chuc v2", màn #/r/:id/quote). Chỉ mở được khi yêu cầu
 * còn chờ báo giá hoặc đã báo giá mà chủ tài sản chưa chọn.
 */
export default function YeuCauKyGuiQuotePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { requests, isLoading, hasOrg, organizationId } = useOrgServiceRequests()
  const request = useMemo(() => requests.find((r) => r.id === id) ?? null, [requests, id])
  const detailHref = `/portal/yeu-cau-ky-gui/${id}`

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

  if (!isOpen(request) && request.status !== 'quoted') {
    return (
      <StateCard>
        <Ban className="mx-auto h-9 w-9 text-muted-foreground" />
        <p className="font-semibold text-foreground">Yêu cầu không còn nhận báo giá</p>
        <p className="text-sm text-muted-foreground">
          Chủ tài sản đã chốt, thu hồi hoặc bạn đã từ chối yêu cầu này.
        </p>
        <Button variant="outline" onClick={() => navigate(detailHref)}>
          Về chi tiết yêu cầu
        </Button>
      </StateCard>
    )
  }

  const header = (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="-mb-3 -ml-2.5 h-[30px] gap-2 self-start text-[13px] text-muted-foreground"
        onClick={() => navigate(detailHref)}
      >
        <ArrowLeft className="h-4 w-4" /> Chi tiết yêu cầu
      </Button>
      <header>
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-foreground">
          {request.quoted_at ? 'Cập nhật báo giá' : 'Gửi báo giá'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Phương án và chi phí dịch vụ đấu giá cho “{request.title}”.
        </p>
      </header>
    </>
  )

  return <QuoteEditor key={request.id} request={request} organizationId={organizationId} header={header} />
}
