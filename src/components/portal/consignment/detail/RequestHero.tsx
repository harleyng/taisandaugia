import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, LayoutGrid, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CHILD_NAME, PARENT_NAME } from '@/constants/category.constants'
import { cn } from '@/lib/utils'
import type { OrgServiceRequest } from '@/types/consignment'
import { requestLocation, requestStatus, type StatusTone } from '../list/requestRows'

const TONE_BADGE: Record<StatusTone, string> = {
  open: 'bg-primary/10 text-primary',
  wait: 'bg-muted text-muted-foreground',
  ok: 'bg-success/10 text-success',
  closed: 'bg-muted text-muted-foreground',
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-medium', className)}>
      {children}
    </span>
  )
}

interface RequestHeroProps {
  request: OrgServiceRequest
  /** Địa chỉ đầy đủ — chỉ có sau khi được chọn (từ hợp đồng); trước đó chỉ quận/tỉnh. */
  fullAddress: string | null
  /** Thanh hành động chạy hết bề ngang dưới banner. */
  actionBar: ReactNode
}

/** Nút quay lại + banner: ảnh bìa | mã, trạng thái, tên, loại, địa chỉ — và thanh việc tiếp theo. */
export function RequestHero({ request: r, fullAddress, actionBar }: RequestHeroProps) {
  const navigate = useNavigate()
  const status = requestStatus(r)
  const cover = r.image_urls?.[0]
  const reopened = !!r.reopened_at && ['sent', 'seen', 'quoted'].includes(r.status)
  const address = fullAddress || requestLocation(r)
  const category = [PARENT_NAME[r.parent_slug] ?? r.parent_slug, CHILD_NAME[r.child_slug]].filter(Boolean).join(' · ')

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="-mb-3 -ml-2.5 h-[30px] gap-2 self-start text-[13px] text-muted-foreground"
        onClick={() => navigate('/portal/yeu-cau-ky-gui')}
      >
        <ArrowLeft className="h-4 w-4" /> Yêu cầu ký gửi
      </Button>

      <section className="grid overflow-hidden rounded-2xl bg-card shadow-card min-[760px]:grid-cols-[240px_minmax(0,1fr)]">
        <div className="relative grid min-h-[160px] place-items-center bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0_6px,hsl(var(--border))_6px_12px)] font-mono text-[11px] font-medium text-muted-foreground min-[760px]:min-h-full">
          {cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" /> : 'ảnh tài sản'}
        </div>

        <div className="flex min-w-0 flex-col gap-3.5 px-6 pb-5 pt-4">
          <div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Badge className="bg-muted font-mono text-[11.5px] text-foreground">{r.posting_code}</Badge>
              <Badge className={TONE_BADGE[status.tone]}>{status.label}</Badge>
              {reopened && <Badge className="bg-accent/20 text-foreground">Mở lại</Badge>}
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.01em] [text-wrap:pretty]">{r.title}</h1>
            {category && (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <LayoutGrid className="h-4 w-4 shrink-0" /> {category}
              </p>
            )}
            {address && (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" /> {address}
              </p>
            )}
          </div>
        </div>

        {actionBar}
      </section>
    </>
  )
}
