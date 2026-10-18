import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileSignature, Send, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHasOrgPermission } from '@/hooks/useOrgPermissions'
import { cn } from '@/lib/utils'
import { CONSIGNMENT_ACTION_LABELS, portalConsignmentContractPath } from '@/lib/contracts/portalRows'
import type { OrgServiceRequest } from '@/types/consignment'
import { CONTRACT_STATUS_LABELS_ORG, type OrgConsignmentContractListRow } from '@/types/consignment-contract'
import { daysUntil, isOpen } from '../list/requestRows'
import { fmtDate } from './format'

function Bar({ title, text, amber, children }: { title: string; text: string; amber?: boolean; children?: ReactNode }) {
  return (
    <div
      className={cn(
        'col-span-full flex flex-wrap items-center gap-4 border-t px-6 py-3.5',
        amber ? 'border-warning/30 bg-warning/[0.08]' : 'border-border bg-muted/50',
      )}
    >
      <div className="min-w-[240px] flex-1 text-sm">
        <b className="block font-semibold">{title}</b>
        <span className="text-muted-foreground">{text}</span>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  )
}

const READ_ONLY = ' Bạn chỉ có quyền xem.'

interface RequestActionBarProps {
  request: OrgServiceRequest
  /** Dòng hợp đồng (RPC org_consignment_contract_list) — chỉ để hiện trạng thái + lối vào. */
  contract: OrgConsignmentContractListRow | null
  onQuote: () => void
  onDecline: () => void
}

/**
 * Thanh "việc tiếp theo" dưới banner: một câu trạng thái + đúng các nút của bước đó.
 * Khi đã có hợp đồng, thanh chỉ còn là LỐI VÀO trang hợp đồng ở menu "Hợp đồng" —
 * mọi thao tác ký nằm ở đó.
 */
export function RequestActionBar({ request: r, contract, onQuote, onDecline }: RequestActionBarProps) {
  const navigate = useNavigate()
  const canUpdate = useHasOrgPermission('yeu-cau-ky-gui', 'update')

  if (isOpen(r)) {
    const d = daysUntil(r.respond_by)
    return (
      <Bar
        title={`Chủ tài sản chờ báo giá đến ${fmtDate(r.respond_by)}${d >= 0 ? ` · còn ${d} ngày` : ''}`}
        text={`Xem thông tin, pháp lý rồi gửi phương án và chi phí — hoặc từ chối nếu không phù hợp.${canUpdate ? '' : READ_ONLY}`}
        amber={d <= 2}
      >
        {canUpdate && (
          <>
            <Button variant="outline" className="gap-2" onClick={onDecline}>
              <XCircle className="h-4 w-4" /> Từ chối
            </Button>
            <Button className="gap-2" onClick={onQuote}>
              <Send className="h-4 w-4" /> Duyệt &amp; báo giá
            </Button>
          </>
        )}
      </Bar>
    )
  }

  if (r.status === 'quoted') {
    return (
      <Bar
        title={`Đã gửi báo giá${r.quote_valid_until ? ` · hiệu lực đến ${fmtDate(r.quote_valid_until)}` : ''}`}
        text={`Chủ tài sản đang so sánh báo giá của các tổ chức. Bạn vẫn cập nhật được báo giá trước khi họ chọn.${canUpdate ? '' : READ_ONLY}`}
      >
        {canUpdate && (
          <>
            <Button variant="ghost" className="text-destructive hover:bg-destructive/[0.08] hover:text-destructive" onClick={onDecline}>
              Rút &amp; từ chối
            </Button>
            <Button className="gap-2" onClick={onQuote}>
              <Send className="h-4 w-4" /> Cập nhật báo giá
            </Button>
          </>
        )}
      </Bar>
    )
  }

  if (!r.contract_id) return null
  const status = contract?.status ?? r.contract_status
  const action = contract?.org_action ?? null
  const code = contract?.code ?? r.contract_code
  const text = action
    ? `Việc tiếp theo: ${CONSIGNMENT_ACTION_LABELS[action].toLowerCase()} — thực hiện ở trang hợp đồng.`
    : status === 'signed'
      ? 'Hợp đồng có hiệu lực — có thể đưa tài sản vào phiên đấu giá.'
      : status === 'cancelled'
        ? 'Hợp đồng đã huỷ.'
        : 'Theo dõi các bước ký và tài liệu ở trang hợp đồng.'

  return (
    <Bar
      title={['Hợp đồng ký gửi', code, status ? CONTRACT_STATUS_LABELS_ORG[status] : null].filter(Boolean).join(' · ')}
      text={text}
      amber={!!action}
    >
      <Button
        variant={action ? 'default' : 'outline'}
        className="gap-2"
        onClick={() => navigate(portalConsignmentContractPath(r.contract_id!))}
      >
        <FileSignature className="h-4 w-4" /> Mở hợp đồng
      </Button>
    </Bar>
  )
}
