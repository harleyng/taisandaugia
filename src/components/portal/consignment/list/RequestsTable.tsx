import { CHILD_NAME } from '@/constants/category.constants'
import { cn } from '@/lib/utils'
import { formatMoneyShort } from '@/utils/money'
import type { OrgServiceRequest } from '@/types/consignment'
import { requestLocation, requestStatus, requestTodo, type StatusTone } from './requestRows'

const TONE_CLASS: Record<StatusTone, string> = {
  open: 'bg-primary/10 text-primary',
  wait: 'bg-foreground/[0.06] text-foreground/80',
  ok: 'bg-success/[0.12] text-success',
  closed: 'bg-muted text-muted-foreground',
}

const TH =
  'whitespace-nowrap border-b bg-muted/40 px-3 py-[11px] text-left text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground xl:px-4'
const TD = 'border-b px-3 py-3.5 align-middle xl:px-4'

function Thumb({ url }: { url: string | undefined }) {
  return (
    <span className="hidden h-11 w-14 shrink-0 place-items-center overflow-hidden rounded-[7px] bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0_5px,hsl(var(--border))_5px_10px)] font-mono text-[9px] font-medium text-muted-foreground xl:grid">
      {url ? <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" /> : 'ảnh'}
    </span>
  )
}

interface RequestsTableProps {
  rows: OrgServiceRequest[]
  onOpen: (r: OrgServiceRequest) => void
}

/** Bảng yêu cầu ký gửi: Tài sản · Khu vực · Giá khởi điểm · Trạng thái · Cần làm. */
export function RequestsTable({ rows, onOpen }: RequestsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
        <thead>
          <tr>
            <th className={cn(TH, 'pl-[22px] xl:pl-[22px]')}>Tài sản</th>
            <th className={cn(TH, 'hidden w-[20%] min-[1100px]:table-cell')}>Khu vực</th>
            <th className={cn(TH, 'w-[110px] text-right')}>Giá khởi điểm</th>
            <th className={cn(TH, 'w-[150px]')}>Trạng thái</th>
            <th className={cn(TH, 'w-[250px] pr-[22px] xl:pr-[22px]')}>Cần làm</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const status = requestStatus(r)
            const todo = requestTodo(r)
            const location = requestLocation(r)
            const price =
              r.pricing_mode === 'appraisal'
                ? 'Nhờ định giá'
                : r.starting_price != null
                  ? formatMoneyShort(r.starting_price)
                  : '—'
            return (
              <tr
                key={r.id}
                tabIndex={0}
                onClick={() => onOpen(r)}
                onKeyDown={(e) => e.key === 'Enter' && onOpen(r)}
                className="cursor-pointer hover:bg-primary/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground [&:last-child>td]:border-b-0"
              >
                <td className={cn(TD, 'pl-[22px] xl:pl-[22px]')}>
                  <div className="flex min-w-0 items-center gap-[13px]">
                    <Thumb url={r.image_urls?.[0]} />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold text-foreground" title={r.title}>
                        {r.title}
                      </p>
                      <p className="truncate text-[12.5px] text-muted-foreground">
                        <span className="rounded-[5px] bg-muted px-1.5 py-px font-mono text-[11.5px] text-foreground">
                          {r.posting_code}
                        </span>
                        {CHILD_NAME[r.child_slug] && ` · ${CHILD_NAME[r.child_slug]}`}
                      </p>
                    </div>
                  </div>
                </td>
                <td className={cn(TD, 'hidden min-[1100px]:table-cell')}>
                  <div className="line-clamp-2 text-[13px] leading-[1.4] text-foreground/80" title={location}>
                    {location || '—'}
                  </div>
                </td>
                <td className={cn(TD, 'text-right tabular-nums')}>
                  <b className="block whitespace-nowrap text-[13.5px] font-semibold">{price}</b>
                </td>
                <td className={TD}>
                  <span
                    className={cn(
                      'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12.5px] font-semibold leading-[1.35]',
                      TONE_CLASS[status.tone],
                    )}
                  >
                    {status.label}
                  </span>
                </td>
                <td className={cn(TD, 'pr-[22px] xl:pr-[22px]')}>
                  {todo ? (
                    <>
                      <span className="whitespace-nowrap text-[13px] font-semibold">{todo.title}</span>
                      {todo.due && (
                        <small
                          className={cn(
                            'mt-0.5 block whitespace-nowrap text-xs',
                            todo.urgent ? 'font-semibold text-destructive' : 'text-muted-foreground',
                          )}
                        >
                          {todo.due}
                        </small>
                      )}
                    </>
                  ) : (
                    <span className="text-border">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
