import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Send, Share2, Upload, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHasOrgPermission } from '@/hooks/useOrgPermissions'
import { cn } from '@/lib/utils'
import { canAttachSigned, canCancel, canConfirm, canShareDraft } from '@/lib/consignment/contractState'
import type { OrgServiceRequest } from '@/types/consignment'
import type { OrgContractDetail } from '@/types/consignment-contract'
import { daysUntil, isOpen } from '../list/requestRows'
import { fmtDate } from './format'

export type ContractDialogKind = 'share' | 'attach' | 'confirm' | 'cancel'

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
  contract: OrgContractDetail | null | undefined
  onQuote: () => void
  onDecline: () => void
  onContract: (kind: ContractDialogKind) => void
}

/** Thanh "việc tiếp theo" dưới banner: một câu trạng thái + đúng các nút của bước đó. */
export function RequestActionBar({ request: r, contract, onQuote, onDecline, onContract }: RequestActionBarProps) {
  const navigate = useNavigate()
  const canUpdate = useHasOrgPermission('yeu-cau-ky-gui', 'update')
  const canCreateSession = useHasOrgPermission('phien-dau-gia', 'create')

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

  if (!contract || contract.contract.status === 'cancelled') return null
  const c = contract.contract
  const actor = canUpdate && contract.can_act
  const suffix = actor ? '' : READ_ONLY
  const cancel = actor && canCancel(c) && (
    <Button
      variant="ghost"
      className="gap-2 text-destructive hover:bg-destructive/[0.08] hover:text-destructive"
      onClick={() => onContract('cancel')}
    >
      <XCircle className="h-4 w-4" /> Huỷ hợp đồng
    </Button>
  )
  const attach = (primary: boolean) =>
    actor &&
    canAttachSigned(c) && (
      <Button variant={primary ? 'default' : 'outline'} className="gap-2" onClick={() => onContract('attach')}>
        <Upload className="h-4 w-4" /> {c.signed_doc_path ? 'Tải bản đã ký khác' : 'Tải bản đã ký'}
      </Button>
    )

  switch (c.status) {
    case 'drafting':
      return (
        <Bar
          title="Soạn dự thảo hợp đồng"
          text={`Lập dự thảo theo phương án và chi phí đã chốt, rồi chia sẻ cho chủ tài sản.${suffix}`}
          amber
        >
          {cancel}
          {actor && canShareDraft(c, 'org') && (
            <Button className="gap-2" onClick={() => onContract('share')}>
              <Share2 className="h-4 w-4" /> Chia sẻ dự thảo
            </Button>
          )}
        </Bar>
      )
    case 'awaiting_signatures':
      return (
        <Bar
          title="Chờ hai bên ký"
          text={`Hai bên ký bản giấy, rồi tải bản scan đã ký lên để cùng xác nhận.${suffix}`}
        >
          {cancel}
          {actor && canShareDraft(c, 'org') && (
            <Button variant="outline" className="gap-2" onClick={() => onContract('share')}>
              <Share2 className="h-4 w-4" /> Chia sẻ dự thảo mới
            </Button>
          )}
          {attach(true)}
        </Bar>
      )
    case 'awaiting_confirmation':
      return canConfirm(c, 'org') ? (
        <Bar
          title="Xác nhận bản đã ký"
          text={`Mở bản đã ký, đối chiếu với dự thảo và xác nhận để hợp đồng có hiệu lực.${suffix}`}
          amber
        >
          {cancel}
          {attach(false)}
          {actor && (
            <Button className="gap-2" onClick={() => onContract('confirm')}>
              <Check className="h-4 w-4" /> Xác nhận bản đã ký
            </Button>
          )}
        </Bar>
      ) : (
        <Bar
          title="Chờ chủ tài sản xác nhận"
          text={`Bạn đã xác nhận bản đã ký. Hợp đồng có hiệu lực khi chủ tài sản cũng xác nhận.${suffix}`}
        >
          {cancel}
          {attach(false)}
        </Bar>
      )
    case 'signed':
      return (
        <Bar title="Hợp đồng có hiệu lực" text="Có thể đưa tài sản vào phiên đấu giá.">
          {canCreateSession && <Button onClick={() => navigate('/portal/phien-dau-gia/moi')}>Tạo phiên đấu giá</Button>}
        </Bar>
      )
    default:
      return null
  }
}
